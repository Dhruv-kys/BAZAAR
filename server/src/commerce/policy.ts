import { GUARDRAILS } from "../guardrails/config.js";
import type { Actor } from "./actor.js";
import type { VerifiedMandate } from "./mandate.js";
import { refuse, type BoundSource, type Refusal } from "./refusals.js";

/**
 * Money invariants. Both doors (human chat, agent MCP) route through here.
 *
 * I1 No caller-supplied money value is trusted; totals come from the catalog.
 * I2 Bounds INTERSECT, never union: a mandate can never raise a merchant limit,
 *    and a merchant limit is never waived by presenting a mandate.
 * I3 A quote binds its total; a confirm that reprices is refused, never adjusted.
 * I4 Mandates are single-use; consumption is atomic and precedes the charge.
 * I5 The merchant holds only the mandate public key, so it cannot forge one.
 * I6 One code path creates a payment link, and claims the order before awaiting.
 * I7 Refusals are audit events with codes, not bare HTTP errors.
 * I8 Counterparty-supplied text never becomes merchant audit reasoning.
 * I9 A quote is confirmed only through the door that staged it, so the gate a
 *    quote was created under cannot be swapped for a weaker one.
 */

export interface Bound {
  source: BoundSource;
  limitInPaise: number;
}

export type Authorization = { ok: true; bounds: Bound[]; binding: Bound } | Refusal;

export function boundsFor(actor: Actor, mandate?: VerifiedMandate): Bound[] {
  const bounds: Bound[] = [
    { source: "merchant_order_cap", limitInPaise: GUARDRAILS.maxOrderValuePaise },
  ];
  if (actor.kind === "agent" && mandate) {
    bounds.push({ source: "mandate", limitInPaise: mandate.claims.ceilingInPaise });
  }
  // A budget the customer set is a bound like any other: it joins the
  // intersection, it can only ever tighten, and the refusal names it when it
  // is the one that binds.
  if (typeof actor.budgetInPaise === "number" && actor.budgetInPaise > 0) {
    bounds.push({ source: "customer_budget", limitInPaise: actor.budgetInPaise });
  }
  return bounds;
}

export function bindingBound(bounds: Bound[]): Bound {
  return bounds.reduce((tightest, bound) =>
    bound.limitInPaise < tightest.limitInPaise ? bound : tightest,
  );
}

export function authorizeTotal(
  totalInPaise: number,
  actor: Actor,
  mandate?: VerifiedMandate,
): Authorization {
  const bounds = boundsFor(actor, mandate);
  const binding = bindingBound(bounds);

  if (totalInPaise > binding.limitInPaise) {
    return refuse(
      "CEILING_EXCEEDED",
      binding.source === "mandate"
        ? `This order exceeds the spend ceiling the mandate authorizes.`
        : binding.source === "customer_budget"
          ? `This order is over the budget you set. Lower the basket, or raise the budget.`
          : `This order exceeds the maximum value the merchant can approve without direct involvement.`,
      {
        source: binding.source,
        limitInPaise: binding.limitInPaise,
        requestedInPaise: totalInPaise,
        shortfallInPaise: totalInPaise - binding.limitInPaise,
      },
    );
  }

  return { ok: true, bounds, binding };
}

export function scopeAllows(mandate: VerifiedMandate, categories: string[]): Refusal | null {
  const allowed = mandate.claims.scope?.categories;
  // No scope claim is unscoped authority. An empty list is authority granted
  // for nothing, which has to refuse everything — treating the two alike lets
  // an explicitly empty grant through as though it were unlimited.
  if (!allowed) return null;

  const violation = categories.find((category) => !allowed.includes(category));
  if (!violation) return null;

  // The category named is ours, from the catalog. The mandate's own list is
  // the principal's text and never reaches the merchant's audit record (I8).
  return refuse(
    "MANDATE_SCOPE_VIOLATION",
    `This mandate does not authorize the "${violation}" category.`,
  );
}
