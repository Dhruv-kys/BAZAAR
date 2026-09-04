import { z } from "zod";
import { refuse, type Refusal } from "./refusals.js";

export interface BillingDetails {
  name: string;
  email: string;
  contact: string;
}

/*
 * Razorpay accepts a customer.contact of 8-14 characters including the country
 * code, so the stored form is always +91 followed by a ten-digit Indian mobile.
 * Everything the merchant prices is in INR, so there is no second country to
 * carry here, and normalising at the edge keeps one shape in the receipt, the
 * payment link and the audit record.
 */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const billingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "A billing name needs at least two characters.")
    .max(60, "A billing name can be at most 60 characters.")
    .regex(/^[\p{L}][\p{L}\p{M}'.\- ]*$/u, "A billing name can only contain letters, spaces, apostrophes and hyphens."),
  email: z.email("That email address is not in a valid format.").trim().max(120),
  contact: z.string().trim(),
});

function normalizeContact(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, "").replace(/^\+?91/, "").replace(/^0/, "");
  return INDIAN_MOBILE.test(digits) ? `+91${digits}` : null;
}

export function parseBillingDetails(input: unknown): BillingDetails | Refusal {
  if (input == null) {
    return refuse(
      "BILLING_DETAILS_REQUIRED",
      "Billing details are required before a payment link is issued. Provide the payer's name, email and mobile number.",
    );
  }

  const parsed = billingSchema.safeParse(input);
  if (!parsed.success) {
    return refuse("BILLING_DETAILS_INVALID", parsed.error.issues[0]?.message ?? "Billing details are not valid.");
  }

  const contact = normalizeContact(parsed.data.contact);
  if (!contact) {
    return refuse(
      "BILLING_DETAILS_INVALID",
      "That mobile number is not a valid Indian mobile number. Use ten digits starting 6-9, optionally prefixed with +91.",
    );
  }

  return { name: parsed.data.name, email: parsed.data.email.toLowerCase(), contact };
}

/*
 * The audit stream is rendered in the browser and kept for the life of the
 * demo, so the payer's identity is recorded in it only in a form that confirms
 * which details were used without republishing them.
 */
export function maskedBilling(billing: BillingDetails): { name: string; email: string; contact: string } {
  const [local, domain] = billing.email.split("@");
  return {
    name: billing.name,
    email: `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`,
    contact: `${billing.contact.slice(0, 3)}${"•".repeat(6)}${billing.contact.slice(-4)}`,
  };
}
