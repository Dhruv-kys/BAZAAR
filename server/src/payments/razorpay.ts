import Razorpay from "razorpay";
import type { PendingOrder } from "./pendingOrderStore.js";

export async function createPaymentLink(order: PendingOrder): Promise<{ id: string; shortUrl: string }> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not configured");
  }

  const description = order.items
    .map((item) => `${item.quantity}x ${item.productName} (${item.variantLabel})`)
    .join(", ");

  const referenceId =
    order.attemptCount === 0 ? order.summaryId : `${order.summaryId}-r${order.attemptCount}`;

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
      notes: { summaryId: order.summaryId, sessionId: order.sessionId },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay payment link creation failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { id: string; short_url: string };
  return { id: data.id, shortUrl: data.short_url };
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  return Razorpay.validateWebhookSignature(rawBody, signature, secret);
}
