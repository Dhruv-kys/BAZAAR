import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import "./PaidReturn.css";

/*
 * Where Razorpay sends the payer back to. Settlement happens on their hosted
 * page, so without this the last thing a customer sees is a receipt from
 * someone else's site — and the order they just paid for is still sitting
 * unconfirmed on a tab behind them.
 *
 * The watcher may not have polled yet when they land, so this keeps asking
 * rather than deciding on the first answer.
 */

interface Status {
  status: "staged" | "awaiting_payment" | "paid";
  receiptNo?: string;
  billedTo?: string;
  totalInPaise?: number;
  paidAt?: string;
}

const POLL_MS = 2000;
const GIVE_UP_AFTER = 20;

const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export function PaidReturn() {
  const [summaryId] = useState(() => new URLSearchParams(window.location.search).get("paid"));
  const [status, setStatus] = useState<Status>();
  const [settled, setSettled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!summaryId) return;
    let live = true;
    let tries = 0;

    const read = async () => {
      try {
        const res = await fetch(apiUrl(`/api/orders/${summaryId}/status`));
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (!live) return;
        setStatus(data);
        if (data.status === "paid") setSettled(true);
      } catch {
        // Offline or the merchant is down; the next tick tries again.
      }
    };

    read();
    const timer = setInterval(() => {
      tries += 1;
      if (settled || tries > GIVE_UP_AFTER) {
        clearInterval(timer);
        return;
      }
      void read();
    }, POLL_MS);

    // Take the marker out of the address bar so a refresh is not a rerun.
    window.history.replaceState({}, "", window.location.pathname);

    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [summaryId, settled]);

  if (!summaryId || dismissed) return null;

  const waiting = !settled;

  return (
    <div className="pr-scrim" role="dialog" aria-modal="true" aria-labelledby="pr-title">
      <div className={`pr${settled ? " is-settled" : ""}`}>
        <span className="pr-mark" aria-hidden="true">
          {settled ? "✓" : "···"}
        </span>

        <h2 id="pr-title">{settled ? "Order confirmed" : "Checking with the bank"}</h2>

        {settled ? (
          <p className="pr-thanks">
            Thank you{status?.billedTo ? `, ${status.billedTo.split(" ")[0]}` : ""} — it&rsquo;s
            being baked.
          </p>
        ) : (
          <p className="pr-thanks">
            Payment received on Razorpay. Waiting for it to reach the shop&hellip;
          </p>
        )}

        <dl className="pr-facts">
          {status?.receiptNo && (
            <div>
              <dt>Receipt</dt>
              <dd>{status.receiptNo}</dd>
            </div>
          )}
          {typeof status?.totalInPaise === "number" && (
            <div>
              <dt>Paid</dt>
              <dd>{rupees(status.totalInPaise)}</dd>
            </div>
          )}
          {status?.billedTo && (
            <div>
              <dt>Billed to</dt>
              <dd>{status.billedTo}</dd>
            </div>
          )}
        </dl>

        <button className="pr-done" type="button" onClick={() => setDismissed(true)}>
          {waiting ? "Back to the shop" : "Order something else"}
        </button>
      </div>
    </div>
  );
}
