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

export type BoundSource = "mandate" | "merchant_order_cap";

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
