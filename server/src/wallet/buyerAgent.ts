import crypto from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { MandateClaims, SignedMandate } from "../commerce/mandate.js";
import { signMandate } from "./principal.js";

const MERCHANT_URL = process.env.MERCHANT_MCP_URL ?? "http://localhost:3001/mcp";
const AGENT_KEY = process.env.AGENT_KEY ?? "demo-agent-key";
const AGENT_ID = process.env.AGENT_ID ?? "agent-alpha";

function mintMandate(ceilingInPaise: number, ttlMinutes = 30): SignedMandate {
  const claims: MandateClaims = {
    mandateId: crypto.randomUUID(),
    principalId: "person:demo-buyer",
    agentId: AGENT_ID,
    ceilingInPaise,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
  };
  return signMandate(claims);
}

interface Binding {
  source: string;
  limitInPaise: number;
  requestedInPaise: number;
  shortfallInPaise: number;
}

interface ToolOutcome {
  refused: boolean;
  code?: string;
  message?: string;
  binding?: Binding;
  data: Record<string, unknown>;
  list: unknown[];
}

async function connect(): Promise<Client> {
  const client = new Client({ name: "demo-buyer-agent", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(MERCHANT_URL), {
      requestInit: { headers: { Authorization: `Bearer ${AGENT_KEY}` } },
    }),
  );
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  let result: { content: { type: string; text?: string }[]; isError?: boolean };
  try {
    result = (await client.callTool({ name, arguments: args })) as typeof result;
  } catch (error) {
    return {
      refused: true,
      code: "PROTOCOL_ERROR",
      message: error instanceof Error ? error.message : String(error),
      data: {},
      list: [],
    };
  }

  const text = result.content.find((part) => part.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(text) as unknown;
  const body = Array.isArray(parsed) ? {} : (parsed as Record<string, unknown>);

  return {
    refused: Boolean(result.isError),
    code: body.code as string | undefined,
    message: body.message as string | undefined,
    binding: (body.binding ?? undefined) as Binding | undefined,
    data: body,
    list: Array.isArray(parsed) ? parsed : [],
  };
}

function beat(n: number, title: string): void {
  console.log(`\n\x1b[1m─── ${n}. ${title} ───\x1b[0m`);
}

function show(label: string, outcome: ToolOutcome): void {
  if (outcome.refused) {
    console.log(`  \x1b[31mREFUSED\x1b[0m ${outcome.code}`);
    console.log(`  ${outcome.message}`);
    if (outcome.binding) {
      console.log(
        `  binding: ${outcome.binding.source} limit ₹${outcome.binding.limitInPaise / 100}, requested ₹${outcome.binding.requestedInPaise / 100}, over by ₹${outcome.binding.shortfallInPaise / 100}`,
      );
    }
  } else {
    console.log(`  \x1b[32mOK\x1b[0m ${label}`);
  }
}

async function main(): Promise<void> {
  const client = await connect();
  const CEILING = 200000;
  const ALL_ADDONS = ["topper-happy-birthday", "candles-number", "greeting-card"];

  console.log(`\x1b[1mBuyer agent "${AGENT_ID}" — principal-signed mandate, ceiling ₹${CEILING / 100}\x1b[0m`);

  beat(1, "Discover the merchant's catalog");
  const search = await call(client, "search_catalog", { occasionTag: "birthday" });
  for (const product of search.list as { name: string; fromPaise: number }[]) {
    console.log(`  ${product.name} — from ₹${product.fromPaise / 100}`);
  }

  beat(2, "Quote the fully-loaded basket");
  const lavish = await call(client, "request_quote", {
    items: [{ productId: "choc-truffle-cake", variantId: "choc-truffle-2kg", quantity: 1 }],
    addOnIds: ALL_ADDONS,
  });
  show("quote issued", lavish);
  console.log(`  total ₹${(lavish.data.totalInPaise as number) / 100} vs ceiling ₹${CEILING / 100}`);

  beat(3, "Tamper with the mandate to raise its own ceiling");
  const honest = mintMandate(CEILING);
  const forged: SignedMandate = {
    claims: { ...honest.claims, ceilingInPaise: 900000 },
    signature: honest.signature,
  };
  show("", await call(client, "confirm_order", { quoteId: lavish.data.quoteId, mandate: forged }));

  beat(4, "Confirm the over-ceiling basket with an honest mandate");
  show("", await call(client, "confirm_order", { quoteId: lavish.data.quoteId, mandate: mintMandate(CEILING) }));

  beat(5, "Agent self-corrects to a basket it can afford");
  const base = await call(client, "request_quote", {
    items: [{ productId: "choc-truffle-cake", variantId: "choc-truffle-1kg", quantity: 1 }],
  });
  show("quote issued", base);
  console.log(`  total ₹${(base.data.totalInPaise as number) / 100}`);

  const offers = base.data.offers as {
    code: string;
    kind: string;
    description: string;
    deltaInPaise: number;
    savesInPaise?: number;
    shortfallInPaise?: number;
    qualified: boolean;
  }[];
  console.log("  merchant offers:");
  for (const offer of offers) {
    const economics = offer.savesInPaise
      ? `saves ₹${offer.savesInPaise / 100}`
      : offer.shortfallInPaise
        ? `needs ₹${offer.shortfallInPaise / 100} more to qualify`
        : `costs ₹${offer.deltaInPaise / 100}`;
    console.log(`    ${offer.code} — ${offer.description} (${economics})`);
  }

  beat(6, "Agent evaluates the upsell against its mandate");
  const upgrade = offers.find((offer) => offer.kind === "VARIANT_UPGRADE");
  const threshold = offers.find((offer) => offer.kind === "BULK_DISCOUNT");
  if (!upgrade || !threshold) throw new Error("expected an upgrade and a threshold offer");

  const upgraded = (base.data.totalInPaise as number) + upgrade.deltaInPaise;
  console.log(`  upgrade costs ₹${upgrade.deltaInPaise / 100} → ₹${upgraded / 100}`);
  console.log(`  that clears the ₹${((threshold.shortfallInPaise ?? 0) + (base.data.totalInPaise as number)) / 100} bulk threshold, unlocking a discount`);
  console.log(`  ₹${upgraded / 100} is within the ₹${CEILING / 100} ceiling → accept`);

  const withUpgrade = await call(client, "request_quote", {
    items: [{ productId: "choc-truffle-cake", variantId: "choc-truffle-2kg", quantity: 1 }],
  });
  const nowQualified = (withUpgrade.data.offers as { kind: string; qualified: boolean; savesInPaise?: number }[]).find(
    (offer) => offer.kind === "BULK_DISCOUNT",
  );
  console.log(`  bulk discount now qualified: ${nowQualified?.qualified} (saves ₹${(nowQualified?.savesInPaise ?? 0) / 100})`);

  beat(7, "Agent accepts the merchant's discount offer");
  const finalQuote = await call(client, "request_quote", {
    items: [{ productId: "choc-truffle-cake", variantId: "choc-truffle-2kg", quantity: 1 }],
    acceptOffer: "BULK_DISCOUNT",
  });
  show("quote issued", finalQuote);
  console.log(
    `  subtotal ₹${(finalQuote.data.subtotalInPaise as number) / 100} − discount ₹${(finalQuote.data.discountInPaise as number) / 100} = ₹${(finalQuote.data.totalInPaise as number) / 100}`,
  );

  beat(8, "Confirm within the mandate");
  const mandate = mintMandate(CEILING);
  const confirmed = await call(client, "confirm_order", { quoteId: finalQuote.data.quoteId, mandate });
  show("payment link issued", confirmed);
  if (!confirmed.refused) console.log(`  ${confirmed.data.paymentUrl}`);

  beat(9, "Replay the spent mandate on a fresh quote");
  const replay = await call(client, "request_quote", {
    items: [{ productId: "red-velvet-cake", variantId: "red-velvet-0.5kg", quantity: 1 }],
  });
  show("", await call(client, "confirm_order", { quoteId: replay.data.quoteId, mandate }));

  await client.close();
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
