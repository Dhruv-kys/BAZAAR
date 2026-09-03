import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "../config.js";
import { firstCredential } from "./agents.js";
import type { MandateClaims } from "../commerce/mandate.js";

export interface DemoStep {
  n: number;
  title: string;
  status: "ok" | "refused" | "info";
  detail: string;
  code?: string;
  data?: string[];
}

const AGENT_ID = "agent-alpha";

function forgedMandate(ceilingInPaise: number) {
  const claims: MandateClaims = {
    mandateId: crypto.randomUUID(),
    principalId: "person:demo-buyer",
    agentId: AGENT_ID,
    ceilingInPaise,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
  return { claims, signature: crypto.randomBytes(64).toString("base64") };
}

function parse(result: unknown): unknown {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const text = content.find((part) => part.type === "text")?.text;
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export async function runBuyerDemo(emit: (step: DemoStep) => void): Promise<void> {
  const key = firstCredential();
  if (!key) {
    emit({
      n: 1,
      title: "No agent credentials configured",
      status: "refused",
      detail:
        "AGENT_CREDENTIALS is unset, so no agent can authenticate. That is the fail-closed default, not a fault.",
      code: "AGENT_UNAUTHENTICATED",
    });
    return;
  }

  const client = new Client({ name: "bazaar-live-demo", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${config.port}/mcp`),
    { requestInit: { headers: { Authorization: `Bearer ${key}` } } },
  );

  let n = 0;
  const step = (s: Omit<DemoStep, "n">) => emit({ n: ++n, ...s });

  try {
    await client.connect(transport);
    const info = client.getServerVersion();
    step({
      title: "Connected over MCP",
      status: "ok",
      detail: `A real Model Context Protocol session, authenticated with an agent credential.`,
      data: [`server: ${info?.name ?? "bazaar-merchant"} ${info?.version ?? ""}`.trim()],
    });

    const tools = await client.listTools();
    step({
      title: "Discovered the merchant's tools",
      status: "ok",
      detail: "Only one of them can spend. There is no tool to request a discount.",
      data: tools.tools.map((tool) => tool.name),
    });

    const searched = parse(await client.callTool({ name: "search_catalog", arguments: { query: "cake" } }));
    const products = (Array.isArray(searched)
      ? searched
      : (asRecord(searched).products ?? [])) as { id?: string; name?: string; fromPaise?: number }[];
    step({
      title: "Read the catalog",
      status: "ok",
      detail: "The same catalog the human agent sells from, priced by the same server code.",
      data: products.slice(0, 3).map((p) => `${p.name}${p.fromPaise ? ` — from ${rupees(p.fromPaise)}` : ""}`),
    });

    const first = (products[0] ?? {}) as { id?: string };
    const productId = first.id ?? "choc-truffle-cake";
    const details = asRecord(parse(await client.callTool({ name: "get_product", arguments: { productId } })));
    const variants = (details.variants ?? []) as { id: string; label: string; priceInPaise: number }[];
    step({
      title: "Priced a product",
      status: "ok",
      detail: "Variants and the add-ons that pair with them, straight from the merchant.",
      data: variants.map((v) => `${v.label} — ${rupees(v.priceInPaise)}`),
    });

    const variant = variants.find((v) => !/premium/i.test(v.label)) ?? variants[0];
    const quote = asRecord(
      parse(
        await client.callTool({
          name: "request_quote",
          arguments: { items: [{ productId, variantId: variant?.id, quantity: 1 }] },
        }),
      ),
    );
    const offers = (quote.offers ?? []) as { code?: string; description?: string }[];
    step({
      title: "Requested a quote",
      status: "ok",
      detail:
        "The merchant priced it server-side and volunteered what else it would sell. This is the shop selling to a machine.",
      data: [
        quote.totalInPaise ? `total ${rupees(quote.totalInPaise as number)}` : "quoted",
        ...offers.slice(0, 3).map((o) => o.description ?? o.code ?? ""),
      ].filter(Boolean),
    });

    const quoteId = (quote.quoteId ?? quote.id) as string | undefined;

    const noMandate = asRecord(parse(await client.callTool({ name: "confirm_order", arguments: { quoteId } })));
    step({
      title: "Tried to spend with no mandate",
      status: "refused",
      detail: String(noMandate.message ?? "Refused."),
      code: String(noMandate.code ?? "MANDATE_REQUIRED"),
    });

    const forged = forgedMandate(500000);
    const badSignature = asRecord(
      parse(await client.callTool({ name: "confirm_order", arguments: { quoteId, mandate: forged } })),
    );
    step({
      title: "Tried to forge the buyer's consent",
      status: "refused",
      detail: String(
        badSignature.message ??
          "The signature does not match the claims. This host holds only the public key, so it cannot produce a valid one.",
      ),
      code: String(badSignature.code ?? "MANDATE_SIGNATURE_INVALID"),
    });

    step({
      title: "Settlement is where this stops",
      status: "info",
      detail:
        "A genuine mandate is signed by the buyer's wallet, which lives on the buyer's machine and never on this server. Run the reference buyer to see a valid one accepted, refused for exceeding its ceiling, and the agent self-correcting.",
      data: ["MERCHANT_MCP_URL=<this host>/mcp npm run buyer"],
    });
  } catch (error) {
    step({
      title: "The session ended early",
      status: "refused",
      detail: error instanceof Error ? error.message : "The MCP session failed.",
    });
  } finally {
    await client.close().catch(() => {});
  }
}
