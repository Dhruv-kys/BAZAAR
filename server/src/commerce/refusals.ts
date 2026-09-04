export const REFUSAL_CODES = [
  "UNKNOWN_PRODUCT",
  "UNKNOWN_ADDON",
  "UNKNOWN_DISCOUNT_REQUEST",
  "EMPTY_ORDER",
  "AGENT_UNAUTHENTICATED",
  "MANDATE_REQUIRED",
  "MANDATE_MALFORMED",
  "MANDATE_SIGNATURE_INVALID",
  "MANDATE_EXPIRED",
  "MANDATE_ALREADY_CONSUMED",
  "MANDATE_AGENT_MISMATCH",
  "MANDATE_SCOPE_VIOLATION",
  "CEILING_EXCEEDED",
  "QUOTE_NOT_FOUND",
  "ORDER_ACTOR_MISMATCH",
  "QUOTE_EXPIRED",
  "PRICE_CHANGED",
  "PAYMENT_IN_PROGRESS",
  "PAYMENT_PROVIDER_ERROR",
  "PAYMENT_PROVIDER_LIMIT",
] as const;

export type RefusalCode = (typeof REFUSAL_CODES)[number];

export type BoundSource = "mandate" | "merchant_order_cap" | "customer_budget";

export interface BindingConstraint {
  source: BoundSource;
  limitInPaise: number;
  requestedInPaise: number;
  shortfallInPaise: number;
}

export interface Refusal {
  ok: false;
  code: RefusalCode;
  message: string;
  binding?: BindingConstraint;
}

export function refuse(code: RefusalCode, message: string, binding?: BindingConstraint): Refusal {
  return binding ? { ok: false, code, message, binding } : { ok: false, code, message };
}

export function isRefusal(value: unknown): value is Refusal {
  return typeof value === "object" && value !== null && (value as Refusal).ok === false;
}

const HTTP_STATUS: Partial<Record<RefusalCode, number>> = {
  AGENT_UNAUTHENTICATED: 401,
  MANDATE_REQUIRED: 401,
  MANDATE_SIGNATURE_INVALID: 403,
  MANDATE_AGENT_MISMATCH: 403,
  MANDATE_EXPIRED: 403,
  MANDATE_ALREADY_CONSUMED: 409,
  ORDER_ACTOR_MISMATCH: 403,
  PAYMENT_IN_PROGRESS: 409,
  QUOTE_NOT_FOUND: 404,
  PAYMENT_PROVIDER_ERROR: 502,
  PAYMENT_PROVIDER_LIMIT: 503,
};

export function httpStatusFor(code: RefusalCode): number {
  return HTTP_STATUS[code] ?? 422;
}

/*
 * The error contract, published at /.well-known/bazaar-commerce so a
 * counterparty can code against it rather than against our prose. Each entry
 * carries the status it answers with, whether the same call could ever succeed
 * unchanged, and what the caller would have to change.
 */
export interface RefusalSpec {
  retryable: boolean;
  meaning: string;
}

export const REFUSAL_CONTRACT: Record<RefusalCode, RefusalSpec> = {
  UNKNOWN_PRODUCT: { retryable: false, meaning: "No product, variant or offer by that id in this merchant's catalog." },
  UNKNOWN_ADDON: { retryable: false, meaning: "No add-on by that id, or it does not pair with anything in the basket." },
  UNKNOWN_DISCOUNT_REQUEST: { retryable: false, meaning: "The discount request id is not one this merchant issued." },
  EMPTY_ORDER: { retryable: false, meaning: "A quote needs at least one line item." },
  AGENT_UNAUTHENTICATED: { retryable: false, meaning: "No recognised agent credential. Credentials are issued by the merchant and never self-served." },
  MANDATE_REQUIRED: { retryable: false, meaning: "An agent must present a principal-signed spend mandate to confirm. There is no unauthorized charge path." },
  MANDATE_MALFORMED: { retryable: false, meaning: "The mandate is missing required claims, or a claim has the wrong shape." },
  MANDATE_SIGNATURE_INVALID: { retryable: false, meaning: "The signature does not match the claims. Altered after signing, or signed by a principal this merchant does not know." },
  MANDATE_EXPIRED: { retryable: false, meaning: "The mandate's expiresAt has passed. Obtain a fresh one from the principal." },
  MANDATE_ALREADY_CONSUMED: { retryable: false, meaning: "Mandates are single-use and consumption is durable. Obtain a fresh one." },
  MANDATE_AGENT_MISMATCH: { retryable: false, meaning: "The mandate authorizes a different agent than the one authenticated on this request." },
  MANDATE_SCOPE_VIOLATION: { retryable: false, meaning: "The basket includes a category the mandate's scope does not cover." },
  CEILING_EXCEEDED: { retryable: true, meaning: "The total exceeds the binding bound. The response names which bound bound and its limit, so the basket can be reduced and re-quoted." },
  QUOTE_NOT_FOUND: { retryable: false, meaning: "No such quote, or it has aged out of the store." },
  ORDER_ACTOR_MISMATCH: { retryable: false, meaning: "A quote is confirmed only through the door that staged it, and only by the party that staged it." },
  QUOTE_EXPIRED: { retryable: true, meaning: "The quote's validity window has passed. Request a fresh quote." },
  PRICE_CHANGED: { retryable: true, meaning: "The basket reprices differently than when quoted. A confirm that reprices is refused, never silently adjusted." },
  PAYMENT_IN_PROGRESS: { retryable: false, meaning: "A payment link for this order is already being created or already exists." },
  PAYMENT_PROVIDER_ERROR: { retryable: true, meaning: "The payment provider could not issue a link. The order remains staged and authorized." },
  PAYMENT_PROVIDER_LIMIT: { retryable: false, meaning: "The merchant's payment provider account has no capacity to issue a new link. Every check passed; only settlement is unavailable." },
};
