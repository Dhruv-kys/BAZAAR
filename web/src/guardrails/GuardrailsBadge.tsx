import { useEffect, useState } from "react";

interface Guardrails {
  maxDiscountPercent: number;
  maxDiscountFlatPaise: number;
  maxOrderValuePaise: number;
  allowedDiscountReasonCodes: string[];
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
    <aside>
      <strong>Active guardrails:</strong> max discount {guardrails.maxDiscountPercent}% or ₹
      {guardrails.maxDiscountFlatPaise / 100}, max order value ₹{guardrails.maxOrderValuePaise / 100}
    </aside>
  );
}
