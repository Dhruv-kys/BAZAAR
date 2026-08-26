import "./CurrencyRail.css";

const MARKS = ["₹", "$", "€", "¥", "£", "₩", "₽", "¢", "₺", "₴", "₪", "₫"];

export function CurrencyRail({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <div className={`rail rail-${side}`} aria-hidden="true">
      <div className="rail-track">
        {[...MARKS, ...MARKS].map((mark, i) => (
          <span key={i} className="rail-mark">
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}
