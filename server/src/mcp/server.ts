import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { addOnsForCategory, getProductById, searchCatalog } from "../catalog/catalog.js";
import { agentActor } from "../commerce/actor.js";
import { confirmOrder } from "../commerce/checkout.js";
import { signedMandateSchema } from "../commerce/mandate.js";
import { requestQuote } from "../commerce/quote.js";
import { isRefusal, type Refusal } from "../commerce/refusals.js";
import { REFUSAL_CODES } from "../commerce/refusals.js";
import { merchant } from "../merchant/profile.js";
import { GUARDRAILS } from "../guardrails/config.js";
import { agentSessionId, resolveAgentId } from "./agents.js";

/**
 * Tool-calling models send an explicit null for an omitted field rather than
 * dropping the key, so every non-required field here is nullish, not optional.
 */
export const agentToolInputs = {
  search_catalog: {
    query: z.string().nullish().describe("Free-text search, e.g. 'chocolate cake'"),
    occasionTag: z.string().nullish().describe("Occasion tag such as 'birthday'"),
    category: z.string().nullish().describe("Product category such as 'cake'"),
  },
  get_product: {
    productId: z.string().describe("Product id from search_catalog"),
  },
  request_quote: {
    items: z
      .array(
        z.object({
          productId: z.string(),
          variantId: z.string(),
          quantity: z.number().int().min(1),
        }),
      )
      .min(1),
    addOnIds: z.array(z.string()).nullish(),
    acceptOffer: z
      .string()
      .nullish()
      .describe("An offer code from a previous quote's offers[] to apply to this one"),
  },
  confirm_order: {
    quoteId: z.string().describe("quoteId from request_quote"),
    mandate: signedMandateSchema.describe("A principal-signed spend mandate authorizing this agent"),
  },
} as const;

interface ToolReply {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

function ok(payload: unknown): ToolReply {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function denied(refusal: Refusal): ToolReply {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { refused: true, code: refusal.code, message: refusal.message, binding: refusal.binding ?? null },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

function buildServer(sessionId: string, agentId: string): McpServer {
  const actor = agentActor(sessionId, agentId);
  const server = new McpServer({ name: "bazaar-merchant", version: "1.0.0" });

  server.registerTool(
    "search_catalog",
    {
      title: "Search catalog",
      description: "Search the merchant's product catalog by free text, occasion tag, or category.",
      inputSchema: agentToolInputs.search_catalog,
    },
    async ({ query, occasionTag, category }) =>
      ok(
        searchCatalog(query ?? undefined, occasionTag ?? undefined, category ?? undefined).map((product) => ({
          productId: product.id,
          name: product.name,
          category: product.category,
          tags: product.tags,
          fromPaise: Math.min(...product.variants.map((variant) => variant.priceInPaise)),
        })),
      ),
  );

  server.registerTool(
    "get_product",
    {
      title: "Get product",
      description: "Full variant pricing for one product, plus the add-ons that pair with it.",
      inputSchema: agentToolInputs.get_product,
    },
    async ({ productId }) => {
      const product = getProductById(productId);
      if (!product) {
        return denied({ ok: false, code: "UNKNOWN_PRODUCT", message: `No product with id "${productId}"` });
      }
      return ok({ ...product, availableAddOns: addOnsForCategory(product.category) });
    },
  );

  server.registerTool(
    "request_quote",
    {
      title: "Request quote",
      description:
        "Price a basket server-side and receive a binding, time-limited quote plus any offers the merchant extends. This does not charge anything.",
      inputSchema: agentToolInputs.request_quote,
    },
    async ({ items, addOnIds, acceptOffer }) => {
      const result = requestQuote({
        items,
        addOnIds: addOnIds ?? undefined,
        acceptOffer: acceptOffer ?? undefined,
        actor,
      });
      return result.ok ? ok(result.quote) : denied(result);
    },
  );

  server.registerTool(
    "confirm_order",
    {
      title: "Confirm order",
      description:
        "Confirm a quote and obtain a payment link. Requires a signed spend mandate authorizing this agent. The mandate is single-use and its ceiling is enforced against the merchant's own limits.",
      inputSchema: agentToolInputs.confirm_order,
    },
    async ({ quoteId, mandate }) => {
      const result = await confirmOrder({ summaryId: quoteId, actor, mandate });
      if (isRefusal(result)) return denied(result);
      return ok({
        quoteId: result.summaryId,
        paymentUrl: result.paymentUrl,
        totalInPaise: result.totalInPaise,
        mandateId: result.mandateId,
        settlement: "Authorization is agentic; settlement completes on the human-approved rail at paymentUrl.",
      });
    },
  );

  return server;
}

export const mcpRouter = Router();

mcpRouter.post("/", async (req: Request, res: Response) => {
  const agentId = resolveAgentId(req);
  if (!agentId) {
    res.status(401).json({
      refused: true,
      code: "AGENT_UNAUTHENTICATED",
      message: "Present a registered agent credential as 'Authorization: Bearer <key>'.",
    });
    return;
  }

  const server = buildServer(agentSessionId(req, agentId), agentId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("mcp request failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "The merchant MCP session failed." });
  }
});

export const wellKnownRouter = Router();

wellKnownRouter.get("/bazaar-commerce", (_req, res) => {
  res.json({
    protocol: "bazaar-commerce/1",
    merchant: { name: merchant.name, currency: merchant.currency, trade: merchant.trade },
    transport: { mcp: "/mcp", auth: "Authorization: Bearer <agent credential>" },
    authorization: {
      scheme: "ed25519-signed-mandate",
      required_for: ["confirm_order"],
      claims: ["mandateId", "principalId", "agentId", "ceilingInPaise", "scope", "issuedAt", "expiresAt"],
      single_use: true,
    },
    policy: {
      maxOrderValuePaise: GUARDRAILS.maxOrderValuePaise,
      maxDiscountPercent: GUARDRAILS.maxDiscountPercent,
      quoteTtlMs: GUARDRAILS.quoteTtlMs,
      bounds: "Mandate ceiling and merchant caps intersect; the tighter always binds.",
    },
    settlement: {
      model: "authorization-agentic/settlement-human",
      rail: "Razorpay Payment Links",
    },
    tools: [
      { name: "search_catalog", writes: false, purpose: "Search the catalog by text, occasion tag or category." },
      { name: "get_product", writes: false, purpose: "Variant pricing for one product, plus the add-ons that pair with it." },
      { name: "request_quote", writes: false, purpose: "Price a basket server-side and return the merchant's offers." },
      { name: "confirm_order", writes: true, purpose: "Spend against a signed mandate. The only tool that moves money." },
    ],
    not_exposed: {
      apply_discount:
        "Discounts are merchant-offered, never counterparty-requested. A buying agent cannot ask for one, and no counterparty text is ever written into the merchant's audit record.",
    },
    refusal_codes: REFUSAL_CODES,
  });
});
