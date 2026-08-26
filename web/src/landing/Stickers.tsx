import { LockIcon, ShieldIcon } from "../icons";
import "./Stickers.css";

export function ClampSticker() {
  return (
    <div className="stk stk-clamp">
      <span className="stk-cap">Guardrail</span>
      <div className="stk-clamp-row">
        <span className="stk-was">50%</span>
        <span className="stk-arrow" aria-hidden="true">
          →
        </span>
        <span className="stk-now">15%</span>
      </div>
      <span className="stk-note">capped by policy</span>
    </div>
  );
}

export function GateSticker() {
  return (
    <div className="stk stk-gate">
      <span className="stk-icon">
        <LockIcon size={15} />
      </span>
      <div>
        <p className="stk-title">Nothing charged yet</p>
        <p className="stk-sub">Awaiting your confirm</p>
      </div>
    </div>
  );
}

export function LimitsSticker() {
  return (
    <div className="stk stk-limits">
      <span className="stk-icon stk-icon-go">
        <ShieldIcon size={15} />
      </span>
      <div>
        <p className="stk-title">Limits live in code</p>
        <p className="stk-sub">Max ₹5,000 · 15% off</p>
      </div>
    </div>
  );
}

export function ReceiptSticker() {
  return (
    <div className="stk stk-receipt">
      <span className="stk-cap">Order summary</span>
      <ul className="stk-lines">
        <li>
          <span>1× Chocolate Truffle · 1 kg</span>
          <b>₹999.00</b>
        </li>
        <li>
          <span>“Happy Birthday” topper</span>
          <b>₹149.00</b>
        </li>
      </ul>
      <div className="stk-total">
        <span>Total after cap</span>
        <b>₹975.80</b>
      </div>
    </div>
  );
}
