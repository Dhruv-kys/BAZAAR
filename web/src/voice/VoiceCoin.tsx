import { Suspense, lazy, useState } from "react";
import type { CoinState } from "../landing/CoinScene";
import "./VoiceCoin.css";

const CoinScene = lazy(() => import("../landing/CoinScene"));

const BAR_COUNT = 13;
const BAR_WEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const centred = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
  return 0.28 + centred * 0.72;
});

function webglAvailable() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Waveform({ state, level }: { state: CoinState; level: number }) {
  const active = state === "listening" || state === "speaking";
  return (
    <div className={`vc-wave${active ? " is-active" : ""}`} data-state={state} aria-hidden="true">
      {BAR_WEIGHTS.map((weight, i) => (
        <i
          key={i}
          style={{
            transform: `scaleY(${active ? 0.16 + level * weight * 2.1 : 0.16})`,
            animationDelay: `${i * 55}ms`,
          }}
        />
      ))}
    </div>
  );
}

interface VoiceCoinProps {
  state: CoinState;
  level: number;
  size: "hero" | "dock";
  onClick: () => void;
  disabled?: boolean;
  label: string;
}

export function VoiceCoin({ state, level, size, onClick, disabled, label }: VoiceCoinProps) {
  const [webgl] = useState(webglAvailable);

  return (
    <button
      type="button"
      className={`vc vc-${size}`}
      data-state={state}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <span className="vc-stage">
        {webgl ? (
          <Suspense fallback={<span className="vc-fallback" aria-hidden="true">₹</span>}>
            <CoinScene state={state} level={level} ceiling={false} />
          </Suspense>
        ) : (
          <span className="vc-fallback" aria-hidden="true">₹</span>
        )}
      </span>
    </button>
  );
}
