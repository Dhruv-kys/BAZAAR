import { useState } from "react";
import { DemoControls } from "../demo/DemoControls";

export interface PendingOrderItem {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
  priceInPaise: number;
}

export interface PendingOrderAddOn {
  addOnId: string;
  name: string;
  priceInPaise: number;
}

export interface PendingOrder {
  summaryId: string;
  items: PendingOrderItem[];
  addOns: PendingOrderAddOn[];
  subtotalInPaise: number;
  discountInPaise: number;
  totalInPaise: number;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function OrderSummaryCard({ order }: { order: PendingOrder }) {
  const [confirming, setConfirming] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string>();
  const [error, setError] = useState<string>();

  async function confirmAndPay() {
    setConfirming(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/orders/${order.summaryId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't confirm the order.");
        return;
      }
      setPaymentUrl(data.paymentUrl);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section>
      <h2>Order Summary</h2>
      <ul>
        {order.items.map((item) => (
          <li key={item.variantId}>
            {item.quantity} x {item.productName} ({item.variantLabel}) - {formatRupees(item.priceInPaise * item.quantity)}
          </li>
        ))}
        {order.addOns.map((addOn) => (
          <li key={addOn.addOnId}>
            {addOn.name} - {formatRupees(addOn.priceInPaise)}
          </li>
        ))}
      </ul>
      <p>Subtotal: {formatRupees(order.subtotalInPaise)}</p>
      {order.discountInPaise > 0 && <p>Discount: -{formatRupees(order.discountInPaise)}</p>}
      <p>
        <strong>Total: {formatRupees(order.totalInPaise)}</strong>
      </p>
      {paymentUrl ? (
        <>
          <a href={paymentUrl} target="_blank" rel="noreferrer">
            Pay ₹{(order.totalInPaise / 100).toFixed(2)} now →
          </a>
          <DemoControls summaryId={order.summaryId} />
        </>
      ) : (
        <button type="button" onClick={confirmAndPay} disabled={confirming}>
          {confirming ? "Preparing payment..." : "Confirm & Pay"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
