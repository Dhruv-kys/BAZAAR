import { useState } from "react";
import { DemoControls } from "../demo/DemoControls";
import "./OrderSummaryCard.css";

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

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    <section className="os">
      <header className="os-head">
        <span className="eyebrow">Order summary</span>
        <span className="os-gate">Nothing is charged until you confirm</span>
      </header>

      <ul className="os-lines">
        {order.items.map((item) => (
          <li key={item.variantId}>
            <span className="os-qty">{item.quantity}×</span>
            <span className="os-name">
              {item.productName}
              <em>{item.variantLabel}</em>
            </span>
            <span className="os-amt">{rupees(item.priceInPaise * item.quantity)}</span>
          </li>
        ))}
        {order.addOns.map((addOn) => (
          <li key={addOn.addOnId} className="os-addon">
            <span className="os-qty">+</span>
            <span className="os-name">{addOn.name}</span>
            <span className="os-amt">{rupees(addOn.priceInPaise)}</span>
          </li>
        ))}
      </ul>

      <div className="os-math">
        <div className="os-row">
          <span>Subtotal</span>
          <span>{rupees(order.subtotalInPaise)}</span>
        </div>
        {order.discountInPaise > 0 && (
          <div className="os-row os-save">
            <span>Discount applied</span>
            <span>−{rupees(order.discountInPaise)}</span>
          </div>
        )}
        <div className="os-row os-total">
          <span>Total</span>
          <span>{rupees(order.totalInPaise)}</span>
        </div>
      </div>

      {paymentUrl ? (
        <div className="os-live">
          <a className="os-pay" href={paymentUrl} target="_blank" rel="noreferrer">
            Pay {rupees(order.totalInPaise)} securely →
          </a>
          <p className="os-note">Razorpay test mode — a real payment link, no real money moves.</p>
          <DemoControls summaryId={order.summaryId} />
        </div>
      ) : (
        <div className="os-actions">
          <button className="os-confirm" type="button" onClick={confirmAndPay} disabled={confirming}>
            {confirming ? "Creating secure link…" : `Confirm & pay ${rupees(order.totalInPaise)}`}
          </button>
          <p className="os-note">Confirming creates a Razorpay payment link. You pay on Razorpay, not here.</p>
        </div>
      )}

      {error && (
        <p className="os-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
