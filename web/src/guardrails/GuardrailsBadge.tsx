import { useEffect, useState } from "react";
import "./GuardrailsBadge.css";

interface Guardrails {
  maxDiscountPercent: number;
  maxDiscountFlatPaise: number;
  maxOrderValuePaise: number;
  allowedDiscountReasonCodes: string[];
}

function shortRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export function GuardrailsBadge() {
  const [guardrails, setGuardrails] = useState<Guardrails>();

  useEffect(() => {
    fetch("/api/guardrails")
      .then((res) => res.json())
      .then(setGuardrails)
      .catch(() => {});
  }, []);

  if (!guardrails) return null;

  return (
    <div className="gb" title="Enforced in server code, not by the model">
      <span className="gb-shield" aria-hidden="true">
        ⛨
      </span>
      <span className="gb-items">
        <span className="gb-item">
          max discount <strong>{guardrails.maxDiscountPercent}%</strong>
        </span>
        <span className="gb-sep" aria-hidden="true" />
        <span className="gb-item">
          cap <strong>{shortRupees(guardrails.maxDiscountFlatPaise)}</strong>
        </span>
        <span className="gb-sep" aria-hidden="true" />
        <span className="gb-item">
          max order <strong>{shortRupees(guardrails.maxOrderValuePaise)}</strong>
        </span>
      </span>
    </div>
  );
}
