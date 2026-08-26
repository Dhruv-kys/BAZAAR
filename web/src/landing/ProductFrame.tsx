import { useEffect, useState } from "react";
import "./ProductFrame.css";

const SCRIPT = [
  { role: "user", text: "Chocolate cake for a birthday, 15 people. First order — 50% off?" },
  { role: "agent", text: "The 1 kg truffle serves 15. I've added the topper, and applied the first-order discount at 15% — the most I'm allowed to give." },
];

const LOG = [
  { t: "16:56:03", tag: "recommend", tone: "blue", body: "Truffle 1 kg · fits 15 guests" },
  { t: "16:56:04", tag: "cross_sell", tone: "cyan", body: "Edible topper" },
  { t: "16:56:15", tag: "discount", tone: "warn", body: "asked 50% → capped 15%", flag: true },
  { t: "16:56:35", tag: "staged", tone: "dim", body: "Awaiting confirmation" },
];

export function ProductFrame() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(LOG.length + 2);
      return;
    }
    const id = setInterval(() => setStep((s) => (s >= LOG.length + 2 ? 0 : s + 1)), 1300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pf" aria-hidden="true">
      <div className="pf-chrome">
        <span className="pf-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="pf-url">bazaar / agent</span>
        <span className="pf-guard">max 15% · cap ₹5,000</span>
      </div>

      <div className="pf-body">
        <div className="pf-chat">
          {SCRIPT.map((m, i) => (
            <div key={i} className={`pf-msg ${m.role}${step > i ? " on" : ""}`}>
              {m.text}
            </div>
          ))}

          <div className={`pf-order${step >= LOG.length + 1 ? " on" : ""}`}>
            <div className="pf-order-head">
              <span>Order summary</span>
              <span className="pf-order-gate">not charged yet</span>
            </div>
            <div className="pf-order-row">
              <span>Chocolate Truffle · 1 kg</span>
              <b>₹999.00</b>
            </div>
            <div className="pf-order-row">
              <span>“Happy Birthday” topper</span>
              <b>₹149.00</b>
            </div>
            <div className="pf-order-row pf-order-cut">
              <span>Discount · capped at 15%</span>
              <b>−₹172.20</b>
            </div>
            <div className="pf-order-total">
              <span>Total</span>
              <b>₹975.80</b>
            </div>
            <div className="pf-order-cta">Confirm &amp; pay ₹975.80</div>
          </div>
        </div>

        <div className="pf-log">
          <div className="pf-log-head">
            <span>audit.log</span>
            <span className="pf-log-live">live</span>
          </div>
          {LOG.map((l, i) => (
            <div key={l.tag} className={`pf-log-row${step > i + 1 ? " on" : ""}`}>
              <span className="pf-log-t">{l.t}</span>
              <span className={`pf-log-tag tone-${l.tone}`}>
                {l.tag}
                {l.flag ? " !" : ""}
              </span>
              <span className="pf-log-b">{l.body}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
