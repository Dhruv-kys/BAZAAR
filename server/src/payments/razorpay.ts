import crypto from "node:crypto";
import type { PendingOrder } from "./pendingOrderStore.js";

export function paymentReferenceId(order: Pick<PendingOrder, "summaryId" | "attemptCount">): string {
  return order.attemptCount === 0 ? order.summaryId : `${order.summaryId}-r${order.attemptCount}`;
}

export function summaryIdFromReference(referenceId: string): string {
  return referenceId.replace(/-r\d+$/, "");
}

export function paymentLinkDescription(order: Pick<PendingOrder, "items">): string {
  return order.items.map((item) => `${item.quantity}x ${item.productName} (${item.variantLabel})`).join(", ");
}

/**
 * Razorpay's REST errors carry a code and a description. Test mode allows 30
 * payment links for the lifetime of an account and never resets — cancelling
 * old links does not free a slot, because creation is what counts. That failure
 * is permanent, so it must not be reported as something worth retrying.
 */
export class PaymentProviderError extends Error {
  readonly code: string;
  readonly description: string;

  constructor(status: number, body: string) {
    let code = `HTTP_${status}`;
    let description = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { code?: string; description?: string } };
      if (parsed.error?.code) code = parsed.error.code;
      if (parsed.error?.description) description = parsed.error.description;
    } catch {
      // Not JSON; the raw body is the best description available.
    }
    super(`Razorpay ${code}: ${description}`);
    this.name = "PaymentProviderError";
    this.code = code;
    this.description = description;
  }

  get isTestModeLinkLimit(): boolean {
    return this.code === "RATE_LIMIT_EXCEEDED" && /test mode limit/i.test(this.description);
  }
}

/*
 * Where Razorpay sends the payer once they have paid. Without it they are left
 * on Razorpay's own page with no way back, and the order they just paid for is
 * still sitting unconfirmed on a tab behind them.
 *
 * APP_ORIGIN is the CORS allowlist and its first entry is the deployed front
 * end, so it is also the right place to come home to.
 */
function returnUrl(summaryId: string): string | undefined {
  const origin = (process.env.APP_ORIGIN ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean);
  if (!origin) return undefined;
  return `${origin.replace(/\/$/, "")}/app?paid=${encodeURIComponent(summaryId)}`;
}

export async function createPaymentLink(order: PendingOrder): Promise<{ id: string; shortUrl: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not configured");
  }

  const description = paymentLinkDescription(order);
  const referenceId = paymentReferenceId(order);

  const res = await fetch("https://api.razorpay.com/v1/payment_links/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: order.totalInPaise,
      currency: "INR",
      description,
      reference_id: referenceId,
      customer: order.billing
        ? { name: order.billing.name, email: order.billing.email, contact: order.billing.contact }
        : undefined,
      /*
       * Razorpay sends the payer an SMS and an email of its own when notify is
       * on, and reminders after that. The address on a staged order is typed
       * into a demo, so the merchant must not have Razorpay mail it: the link
       * is handed back over the API and shown in the browser instead.
       */
      notify: { sms: false, email: false },
      reminder_enable: false,
      // callback_method must be "get" whenever callback_url is sent.
      ...(returnUrl(order.summaryId)
        ? { callback_url: returnUrl(order.summaryId), callback_method: "get" }
        : {}),
      notes: {
        summaryId: order.summaryId,
        sessionId: order.sessionId,
        ...(order.receiptNo ? { receiptNo: order.receiptNo } : {}),
        ...(order.billing ? { billingName: order.billing.name } : {}),
      },
    }),
  });

  if (!res.ok) {
    throw new PaymentProviderError(res.status, await res.text());
  }

  const data = (await res.json()) as { id: string; short_url: string };
  return { id: data.id, shortUrl: data.short_url };
}

export async function getPaymentLinkStatus(paymentLinkId: string): Promise<string> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not configured");
  }

  const res = await fetch(`https://api.razorpay.com/v1/payment_links/${paymentLinkId}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
  });
  if (!res.ok) {
    throw new Error(`Razorpay payment link fetch failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as { status: string };
  return data.status;
}

/**
 * The same HMAC the Razorpay SDK computes, compared in constant time: the SDK's
 * own validateWebhookSignature ends in a plain `===` over the hex digest, which
 * leaks a comparison-length signal. razorpay.test.ts pins the two to agree.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
