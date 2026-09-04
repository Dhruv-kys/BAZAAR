import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MandateClaims } from "../commerce/mandate.js";
import { config } from "../config.js";
import { signMandate } from "../wallet/principal.js";
import { firstAgent } from "./agents.js";

/**
 * Exercises the agent door against a running server over real MCP.
 *
 * Every confirm here is one the merchant must refuse, so the run can never
 * reach createPaymentLink. Razorpay's test mode allows 30 payment links for the
 * lifetime of the account and will not reset, so a rehearsal that could spend
 * one is a rehearsal nobody can afford to repeat.
 */

const BASE = process.env.MERCHANT_URL ?? `http://127.0.0.1:${config.port}`;

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, saw?: unknown): void {
  if (ok) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    return;
  }
  failed++;
  console.log(`  \x1b[31m✗\x1b[0m ${name}${saw === undefined ? "" : ` — saw ${JSON.stringify(saw)}`}`);
}

function heading(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function session(key?: string) {
  const client = new Client({ name: "bazaar-door-check", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: key ? { headers: { Authorization: `Bearer ${key}` } } : {},
  });
  return { client, transport };
}

function payload(result: unknown): Record<string, any> {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  const text = content.find((part) => part.type === "text")?.text;
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { value: parsed };
    return parsed && typeof parsed === "object" ? parsed : { value: parsed };
  } catch {
    return { unparsed: text };
  }
}

async function connects(key: string | undefined): Promise<boolean> {
  const { client, transport } = session(key);
  try {
    await client.connect(transport);
    await client.close().catch(() => {});
    return true;
  } catch {
    await client.close().catch(() => {});
    return false;
  }
}

async function main(): Promise<void> {
  const agent = firstAgent();
  if (!agent) {
    console.error("AGENT_CREDENTIALS is unset, so no agent can authenticate. Set it and retry.");
    process.exit(1);
  }

  const claims = (over: Partial<MandateClaims> = {}): MandateClaims => ({
    mandateId: crypto.randomUUID(),
    principalId: "person:door-check",
    agentId: agent.agentId,
    ceilingInPaise: 500000,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    ...over,
  });

  heading("Authentication fails closed");
  check("no credential is turned away", !(await connects(undefined)));
  check("an unknown credential is turned away", !(await connects("not-a-real-key")));

  const { client, transport } = session(agent.key);
  await client.connect(transport);
  const call = (name: string, args: Record<string, unknown>) =>
    client.callTool({ name, arguments: args }).then(payload);

  heading("Handshake");
  check("an issued credential connects", true);
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  check("four tools are published", tools.length === 4, tools);
  check("none of them applies a discount", !tools.some((name) => /discount/i.test(name)), tools);

  heading("A tool-calling model's explicit nulls");
  const found = await call("search_catalog", { query: "cake", occasionTag: null, category: null });
  const products = (Array.isArray(found.value) ? found.value : found.products) as any[];
  check("search_catalog takes them", Array.isArray(products) && products.length > 0, found);

  const productId = products[0].productId ?? products[0].id;
  const detail = await call("get_product", { productId });
  const variants = detail.variants as { id: string; priceInPaise: number }[];
  check("get_product prices every variant", variants?.length > 0, detail);

  const cheapest = [...variants].sort((a, b) => a.priceInPaise - b.priceInPaise)[0];
  const quote = await call("request_quote", {
    items: [{ productId, variantId: cheapest.id, quantity: 1 }],
    addOnIds: null,
    acceptOffer: null,
  });
  check("request_quote takes them", typeof quote.quoteId === "string", quote);
  check("the merchant prices it server-side", typeof quote.totalInPaise === "number", quote.totalInPaise);
  check("the merchant volunteers offers", Array.isArray(quote.offers) && quote.offers.length > 0);

  heading("The gate");
  const bare = await call("confirm_order", { quoteId: quote.quoteId });
  check("no mandate is refused by the policy core", bare.code === "MANDATE_REQUIRED", bare);

  const honest = signMandate(claims());
  const unsigned = { claims: honest.claims, signature: crypto.randomBytes(64).toString("base64") };
  check(
    "a forged signature is refused",
    (await call("confirm_order", { quoteId: quote.quoteId, mandate: unsigned })).code ===
      "MANDATE_SIGNATURE_INVALID",
  );

  const raised = { claims: { ...honest.claims, ceilingInPaise: 90_000_000 }, signature: honest.signature };
  check(
    "a ceiling raised after signing is refused",
    (await call("confirm_order", { quoteId: quote.quoteId, mandate: raised })).code ===
      "MANDATE_SIGNATURE_INVALID",
  );

  const someoneElse = await call("confirm_order", {
    quoteId: quote.quoteId,
    mandate: signMandate(claims({ agentId: "agent-not-this-one" })),
  });
  check("another agent's mandate is refused", someoneElse.code === "MANDATE_AGENT_MISMATCH", someoneElse);
  check(
    "the refusal quotes no claim text back into our record",
    !JSON.stringify(someoneElse).includes("agent-not-this-one"),
    someoneElse.message,
  );

  check(
    "an expired mandate is refused",
    (await call("confirm_order", {
      quoteId: quote.quoteId,
      mandate: signMandate(claims({ expiresAt: new Date(Date.now() - 60_000).toISOString() })),
    })).code === "MANDATE_EXPIRED",
  );

  heading("Bounds intersect");
  const tight = await call("confirm_order", {
    quoteId: quote.quoteId,
    mandate: signMandate(claims({ ceilingInPaise: Math.max(100, (quote.totalInPaise as number) - 100) })),
  });
  check("a ceiling under the total refuses", tight.code === "CEILING_EXCEEDED", tight);
  check("the binding constraint is named", tight.binding?.source === "mandate", tight.binding);
  check("its limit is handed back so the agent can self-correct", typeof tight.binding?.limitInPaise === "number");

  heading("One quote, one door");
  const crossed = await fetch(`${BASE}/api/orders/${quote.quoteId}/confirm`, { method: "POST" });
  const crossedBody = await crossed.json();
  check(
    "the human route will not confirm an agent's quote",
    crossedBody.code === "ORDER_ACTOR_MISMATCH",
    crossedBody,
  );

  heading("Discovery");
  const wellKnown = await (await fetch(`${BASE}/.well-known/bazaar-commerce`)).json();
  check("the settlement split is published", wellKnown.settlement?.model === "authorization-agentic/settlement-human", wellKnown.settlement);

  await client.close().catch(() => {});

  console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m`);
  console.log("No payment link was created.\n");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nThe door check could not finish: ${error instanceof Error ? error.message : error}`);
  console.error(`Is the server running and reachable at ${BASE}?\n`);
  process.exit(1);
});
