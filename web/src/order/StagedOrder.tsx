import { useEffect, useState, type InputHTMLAttributes } from "react";
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

type Phase = "staged" | "billing" | "authorizing" | "authorized" | "declined" | "settled";

interface BillingForm {
  name: string;
  email: string;
  contact: string;
}

interface Receipt {
  receiptNo?: string;
  billedTo?: string;
  paymentLinkId?: string;
  paidAt?: string;
}

const EMPTY_BILLING: BillingForm = { name: "", email: "", contact: "" };

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/*
 * The same three rules the server applies, so a typo is caught before it costs
 * a round trip. The server stays the authority: its refusal is what the card
 * reports if these ever disagree.
 */
function billingProblems(form: BillingForm): Partial<Record<keyof BillingForm, string>> {
  const problems: Partial<Record<keyof BillingForm, string>> = {};
  if (form.name.trim().length < 2) problems.name = "Name the person this is billed to.";
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(form.email.trim())) problems.email = "That email is not a valid address.";
  if (!/^[6-9]\d{9}$/.test(form.contact)) problems.contact = "Ten digits, starting 6 to 9.";
  return problems;
}

export function StagedOrder({ order }: { order: PendingOrder }) {
  const [phase, setPhase] = useState<Phase>("staged");
  const [payUrl, setPayUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState<BillingForm>(EMPTY_BILLING);
  const [touched, setTouched] = useState(false);
  const [receipt, setReceipt] = useState<Receipt>({});

  const problems = billingProblems(billing);

  useEffect(() => {
    if (!payUrl || phase === "settled") return;
    const id = setInterval(async () => {
      try {
        const { ok, data } = await apiJson<{ status?: string } & Receipt>(`/api/orders/${order.summaryId}/status`);
        if (!ok) return;
        setReceipt((current) => ({ ...current, ...data }));
        if (data.status === "paid") setPhase("settled");
      } catch {
      }
    }, 5000);
    return () => clearInterval(id);
  }, [payUrl, phase, order.summaryId]);

  async function confirm() {
    setTouched(true);
    if (Object.keys(problems).length > 0) return;

    setPhase("authorizing");
    setError(undefined);
    try {
      const { ok, data } = await apiJson<{ paymentUrl?: string; receiptNo?: string; error?: string }>(
        `/api/orders/${order.summaryId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billing: { name: billing.name.trim(), email: billing.email.trim(), contact: `+91${billing.contact}` },
          }),
        },
      );
      if (!ok || !data.paymentUrl) {
        setError(data.error ?? "The server refused this order.");
        setPhase("billing");
        return;
      }
      setReceipt({ receiptNo: data.receiptNo, billedTo: billing.name.trim() });
      setPayUrl(data.paymentUrl);
      setPhase("authorized");
    } catch (err) {
      setError(err instanceof ApiUnavailableError ? "Backend unreachable. No payment link was created." : "Confirmation failed.");
      setPhase("billing");
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

  const locked = phase === "staged" || phase === "billing" || phase === "authorizing";

  function field(key: keyof BillingForm, label: string, props: InputHTMLAttributes<HTMLInputElement>) {
    const problem = touched ? problems[key] : undefined;
    return (
      <label className={`so-field ${problem ? "is-bad" : ""}`}>
        <span className="so-field-label">{label}</span>
        <span className="so-field-input">
          {key === "contact" && <span className="so-field-prefix">+91</span>}
          <input
            {...props}
            value={billing[key]}
            aria-invalid={Boolean(problem)}
            onChange={(event) => {
              const next = key === "contact" ? event.target.value.replace(/\D/g, "").slice(0, 10) : event.target.value;
              setBilling((current) => ({ ...current, [key]: next }));
            }}
          />
        </span>
        {problem && <span className="so-field-problem">{problem}</span>}
      </label>
    );
  }

  return (
    <section className={`so so-${phase}`} aria-labelledby="so-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="so-title">
          Your order
        </h2>
        <span className="so-id">{receipt.receiptNo ?? order.summaryId.slice(0, 8)}</span>
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
          <div className="so-receipt" role="status">
            <p className="so-settled">
              <CheckIcon size={14} />
              Payment received. You are all set.
            </p>
            <dl className="so-receipt-lines">
              <div>
                <dt>Receipt</dt>
                <dd>{receipt.receiptNo ?? "—"}</dd>
              </div>
              <div>
                <dt>Billed to</dt>
                <dd>{receipt.billedTo ?? "—"}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{receipt.paidAt ? new Date(receipt.paidAt).toLocaleString("en-IN") : "—"}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{receipt.paymentLinkId ?? order.summaryId.slice(0, 8)}</dd>
              </div>
            </dl>
          </div>
        ) : phase === "declined" ? (
          <div className="so-recovered" role="status">
            <span className="so-recovered-head">That payment was declined</span>
            <ul className="so-recovered-list">
              <li>We recorded what happened</li>
              <li>Your order is still here</li>
              <li>Receipt {receipt.receiptNo} still stands</li>
            </ul>
            <a className="so-act so-act-retry" href={payUrl} target="_blank" rel="noreferrer">
              Retry payment
            </a>
          </div>
        ) : phase === "authorized" ? (
          <div className="so-open">
            <p className="so-billed">
              Receipt <strong>{receipt.receiptNo}</strong> issued to <strong>{receipt.billedTo}</strong>
            </p>
            <a className="so-act" href={payUrl} target="_blank" rel="noreferrer">
              <LockIcon size={14} />
              Pay {rupees(order.totalInPaise)} on Razorpay
            </a>
            <button className="so-decline" type="button" onClick={simulateDecline} disabled={busy}>
              {busy ? "Simulating…" : "Simulate a declined payment"}
            </button>
          </div>
        ) : phase === "staged" ? (
          <button className="so-act so-confirm" type="button" onClick={() => setPhase("billing")}>
            Continue to billing
          </button>
        ) : (
          <form
            className="so-billing"
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            <p className="so-billing-head">Who is this order billed to?</p>
            {field("name", "Billing name", { autoComplete: "name", placeholder: "Ananya Rao", maxLength: 60 })}
            {field("email", "Email for the receipt", {
              type: "email",
              autoComplete: "email",
              placeholder: "ananya@example.com",
              maxLength: 120,
            })}
            {field("contact", "Mobile", {
              type: "tel",
              inputMode: "numeric",
              autoComplete: "tel-national",
              placeholder: "9876543210",
            })}
            <button className="so-act so-confirm" type="submit" disabled={phase === "authorizing"}>
              {phase === "authorizing" ? "Creating payment link…" : `Confirm ${rupees(order.totalInPaise)}`}
            </button>
          </form>
        )}

        <p className="so-fine">
          {phase === "staged"
            ? "Nothing is charged yet. A payment link is only created after you confirm."
            : locked
              ? "These details go on the receipt and on the Razorpay payment link. Nothing is charged yet."
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
