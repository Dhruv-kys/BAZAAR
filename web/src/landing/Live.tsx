import "./Live.css";

const LOG_LINES = [
  { time: "16:56:03", tone: "blue", tag: "recommend", body: "1 kg suits a birthday for fifteen" },
  { time: "16:56:04", tone: "cyan", tag: "cross_sell", body: "Edible topper matches the occasion" },
  { time: "16:56:15", tone: "warn", tag: "discount", body: "FIRST_ORDER · 50% → 15% capped" },
  { time: "16:56:35", tone: "dim", tag: "staged", body: "Summary awaiting your confirm" },
  { time: "16:57:00", tone: "go", tag: "pay_link", body: "Link created for ₹975.80" },
];

export function LiveLog() {
  return (
    <div className="live" aria-hidden="true">
      <div className="live-bar">
        <span className="live-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="live-title">audit.log</span>
        <span className="live-pulse" />
      </div>
      <div className="live-body">
        {LOG_LINES.map((l, i) => (
          <p key={l.tag} className="live-line" style={{ animationDelay: `${i * 1.6}s` }}>
            <span className="live-time">{l.time}</span>
            <span className={`live-tag tone-${l.tone}`}>{l.tag}</span>
            <span className="live-text">{l.body}</span>
          </p>
        ))}
        <span className="live-caret" />
      </div>
    </div>
  );
}

export function ClampMeter() {
  return (
    <div className="meter" aria-hidden="true">
      <div className="meter-head">
        <span className="meter-cap">Discount requested</span>
        <span className="meter-val">
          <span className="meter-val-hi">50%</span>
          <span className="meter-val-lo">15%</span>
        </span>
      </div>
      <div className="meter-track">
        <span className="meter-fill" />
        <span className="meter-cap-line" />
      </div>
      <div className="meter-foot">
        <span className="meter-limit">policy ceiling 15%</span>
        <span className="meter-flag">capped</span>
      </div>
    </div>
  );
}

export function GateFlow() {
  const steps = ["intent", "recommend", "cap", "gate", "pay"];
  return (
    <div className="flow" aria-hidden="true">
      <span className="flow-beam" />
      {steps.map((s, i) => (
        <span key={s} className="flow-node" style={{ animationDelay: `${i * 0.85}s` }}>
          <i />
          {s}
        </span>
      ))}
    </div>
  );
}
