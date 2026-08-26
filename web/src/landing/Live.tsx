import { useEffect, useState } from "react";
import "./Live.css";

interface Row {
  time: string;
  event: string;
  detail: string;
  amount: string;
  status: "ok" | "capped" | "held";
}

const ROWS: Row[] = [
  { time: "16:56:03", event: "recommend", detail: "Truffle 1 kg · birthday, 15", amount: "₹999.00", status: "ok" },
  { time: "16:56:04", event: "cross_sell", detail: "Edible topper", amount: "₹149.00", status: "ok" },
  { time: "16:56:15", event: "discount", detail: "FIRST_ORDER · asked 50%", amount: "−₹172.20", status: "capped" },
  { time: "16:56:35", event: "summary", detail: "Awaiting confirmation", amount: "₹975.80", status: "held" },
  { time: "16:57:00", event: "pay_link", detail: "Razorpay · test mode", amount: "₹975.80", status: "ok" },
];

const STATUS_LABEL: Record<Row["status"], string> = {
  ok: "cleared",
  capped: "capped",
  held: "held",
};

export function LiveLog() {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(ROWS.length);
      return;
    }
    const id = setInterval(() => setShown((n) => (n >= ROWS.length ? 1 : n + 1)), 1500);
    return () => clearInterval(id);
  }, []);

  const visible = ROWS.slice(0, shown);
  const capped = visible.filter((r) => r.status === "capped").length;

  return (
    <figure className="ledger">
      <figcaption className="ledger-bar">
        <span className="ledger-title">Decision ledger</span>
        <span className="ledger-live">
          <i />
          live
        </span>
      </figcaption>

      <div className="ledger-rows">
        {ROWS.map((row, i) => (
          <div key={row.event} className={`ledger-row${i < shown ? " is-in" : ""}`}>
            <span className="ledger-time">{row.time}</span>
            <span className="ledger-event">{row.event}</span>
            <span className="ledger-detail">{row.detail}</span>
            <span className="ledger-amount">{row.amount}</span>
            <span className={`ledger-status st-${row.status}`}>{STATUS_LABEL[row.status]}</span>
          </div>
        ))}
      </div>

      <div className="ledger-foot">
        <span>
          <b>{visible.length}</b> logged
        </span>
        <span>
          <b>{capped}</b> capped
        </span>
        <span className="ledger-total">₹975.80</span>
      </div>
    </figure>
  );
}
