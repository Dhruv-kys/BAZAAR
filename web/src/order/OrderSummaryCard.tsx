import { useEffect, useState } from "react";
import { DemoControls } from "../demo/DemoControls";
import { ArrowUpRightIcon, CheckIcon, LockIcon, ShieldIcon } from "../icons";
import "./OrderSummaryCard.css";
import { apiUrl } from "../api";

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
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!paymentUrl || paid) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/api/orders/${order.summaryId}/status`));
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "paid") setPaid(true);
      } catch {
        // transient; keep polling
      }
    }, 5000);
    return () => clearInterval(id);
  }, [paymentUrl, paid, order.summaryId]);

  async function confirmAndPay() {
    setConfirming(true);
    setError(undefined);
    try {
      const res = await fetch(apiUrl(`/api/orders/${order.summaryId}/confirm`), { method: "POST" });
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
      <div className="os-core">
        <header className="os-head">
          <span className="eyebrow">Order summary</span>
          <span className="os-gate">
            <LockIcon size={12} />
            Nothing is charged until you confirm
          </span>
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

        {paid ? (
          <div className="os-paid" role="status">
            <span className="os-paid-badge">
              <CheckIcon size={14} />
              Payment received
            </span>
            <p className="os-note">Order confirmed and recorded in the audit log. No further action needed.</p>
          </div>
        ) : paymentUrl ? (
          <div className="os-live">
            <a className="os-pay" href={paymentUrl} target="_blank" rel="noreferrer">
              <span>Pay {rupees(order.totalInPaise)} on Razorpay</span>
              <span className="os-orb" aria-hidden="true">
                <ArrowUpRightIcon size={15} />
              </span>
            </a>
            <p className="os-secured">
              <ShieldIcon size={12} />
              Card details are entered on Razorpay — never on this site
            </p>
            <p className="os-note">Razorpay test mode: a real payment link, but no real money moves.</p>
            <DemoControls summaryId={order.summaryId} />
          </div>
        ) : (
          <div className="os-actions">
            <button className="os-confirm" type="button" onClick={confirmAndPay} disabled={confirming}>
              <span>{confirming ? "Creating secure link…" : `Confirm & pay ${rupees(order.totalInPaise)}`}</span>
              <span className="os-orb" aria-hidden="true">
                <LockIcon size={15} />
              </span>
            </button>
            <p className="os-secured">
              <ShieldIcon size={12} />
              Card details are entered on Razorpay — never on this site
            </p>
            <p className="os-note">Confirming only creates a payment link. You choose when to pay.</p>
          </div>
        )}

        {error && (
          <p className="os-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
