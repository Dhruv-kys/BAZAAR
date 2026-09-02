import { useEffect, useState } from "react";
import { ApiUnavailableError, apiJson } from "../api";
import { CheckIcon, LockIcon } from "../icons";
import "./StagedOrder.css";

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

type Phase = "staged" | "authorizing" | "authorized" | "declined" | "settled";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StagedOrder({ order }: { order: PendingOrder }) {
  const [phase, setPhase] = useState<Phase>("staged");
  const [payUrl, setPayUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!payUrl || phase === "settled") return;
    const id = setInterval(async () => {
      try {
        const { ok, data } = await apiJson<{ status?: string }>(`/api/orders/${order.summaryId}/status`);
        if (ok && data.status === "paid") setPhase("settled");
      } catch {
        // transient or offline; the badge on the system bar carries that signal
      }
    }, 5000);
    return () => clearInterval(id);
  }, [payUrl, phase, order.summaryId]);

  async function confirm() {
    setPhase("authorizing");
    setError(undefined);
    try {
      const { ok, data } = await apiJson<{ paymentUrl?: string; error?: string }>(
        `/api/orders/${order.summaryId}/confirm`,
        { method: "POST" },
      );
      if (!ok || !data.paymentUrl) {
        setError(data.error ?? "The server refused this order.");
        setPhase("staged");
        return;
      }
      setPayUrl(data.paymentUrl);
      setPhase("authorized");
    } catch (err) {
      setError(err instanceof ApiUnavailableError ? "Backend unreachable. No payment link was created." : "Confirmation failed.");
      setPhase("staged");
    }
  }

  async function simulateDecline() {
    setBusy(true);
    setError(undefined);
    try {
      const { ok, data } = await apiJson<{ retryUrl?: string; error?: string }>(
        `/api/payments/${order.summaryId}/simulate-failure`,
        { method: "POST" },
      );
      if (!ok || !data.retryUrl) {
        setError(data.error ?? "Could not simulate a decline.");
        return;
      }
      setPayUrl(data.retryUrl);
      setPhase("declined");
    } catch {
      setError("Backend unreachable.");
    } finally {
      setBusy(false);
    }
  }

  const locked = phase === "staged" || phase === "authorizing";

  return (
    <section className={`so so-${phase}`} aria-labelledby="so-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="so-title">
          Your order
        </h2>
        <span className="so-id">{order.summaryId.slice(0, 8)}</span>
      </div>

      <ul className="so-lines">
        {order.items.map((item) => (
          <li key={item.variantId}>
            <span className="so-qty">{item.quantity}&times;</span>
            <span className="so-name">
              {item.productName}
              <em>{item.variantLabel}</em>
            </span>
            <span className="so-amt">{rupees(item.priceInPaise * item.quantity)}</span>
          </li>
        ))}
        {order.addOns.map((addOn) => (
          <li key={addOn.addOnId}>
            <span className="so-qty">+</span>
            <span className="so-name">{addOn.name}</span>
            <span className="so-amt">{rupees(addOn.priceInPaise)}</span>
          </li>
        ))}
      </ul>

      <div className="so-math">
        <div className="so-row">
          <span>Subtotal</span>
          <span>{rupees(order.subtotalInPaise)}</span>
        </div>
        {order.discountInPaise > 0 && (
          <div className="so-row so-cut">
            <span>Discount</span>
            <span>&minus;{rupees(order.discountInPaise)}</span>
          </div>
        )}
        <div className="so-row so-total">
          <span>Total</span>
          <span>{rupees(order.totalInPaise)}</span>
        </div>
      </div>

      <div className="so-gate">
        <div className="so-authority">
          <div>
            <span className="so-auth-key">The agent</span>
            <span className="so-auth-val">Can only suggest</span>
          </div>
          <div>
            <span className="so-auth-key">Payment</span>
            <span className={`so-auth-val ${locked ? "is-locked" : "is-open"}`}>
              {locked ? "Waiting for you" : "You approved it"}
            </span>
          </div>
        </div>

        {phase === "settled" ? (
          <p className="so-settled" role="status">
            <CheckIcon size={14} />
            Payment received. You are all set.
          </p>
        ) : phase === "declined" ? (
          <div className="so-recovered" role="status">
            <span className="so-recovered-head">That payment was declined</span>
            <ul className="so-recovered-list">
              <li>We recorded what happened</li>
              <li>Your order is still here</li>
              <li>A new payment link is ready</li>
            </ul>
            <a className="so-act so-act-retry" href={payUrl} target="_blank" rel="noreferrer">
              Retry payment
            </a>
          </div>
        ) : phase === "authorized" ? (
          <div className="so-open">
            <a className="so-act" href={payUrl} target="_blank" rel="noreferrer">
              <LockIcon size={14} />
              Pay {rupees(order.totalInPaise)} on Razorpay
            </a>
            <button className="so-decline" type="button" onClick={simulateDecline} disabled={busy}>
              {busy ? "Simulating…" : "Simulate a declined payment"}
            </button>
          </div>
        ) : (
          <button className="so-act so-confirm" type="button" onClick={confirm} disabled={phase === "authorizing"}>
            {phase === "authorizing" ? "Creating payment link…" : `Confirm ${rupees(order.totalInPaise)}`}
          </button>
        )}

        <p className="so-fine">
          {locked
            ? "Nothing is charged yet. A payment link is only created after you tap confirm."
            : "Card details are entered on Razorpay, never on this site."}
        </p>

        {error && (
          <p className="so-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
