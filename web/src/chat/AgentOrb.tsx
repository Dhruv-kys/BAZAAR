import "./AgentOrb.css";

export function AgentOrb() {
  return (
    <div className="orb" aria-hidden="true">
      <svg viewBox="0 0 300 300" className="orb-svg">
        <defs>
          <radialGradient id="orb-core-fill" cx="38%" cy="32%">
            <stop offset="0%" stopColor="var(--orb-hi)" />
            <stop offset="55%" stopColor="var(--orb-mid)" />
            <stop offset="100%" stopColor="var(--orb-low)" />
          </radialGradient>
          <linearGradient id="orb-sweep" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--orb-stroke)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--orb-stroke)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--orb-stroke)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle className="orb-track" cx="150" cy="150" r="138" />
        <circle className="orb-track" cx="150" cy="150" r="106" />
        <circle className="orb-track orb-dashed" cx="150" cy="150" r="72" />

        <circle className="orb-sweep" cx="150" cy="150" r="138" stroke="url(#orb-sweep)" />
        <circle className="orb-sweep orb-sweep-2" cx="150" cy="150" r="106" stroke="url(#orb-sweep)" />

        <circle className="orb-core" cx="150" cy="150" r="42" fill="url(#orb-core-fill)" />
        <circle className="orb-core-edge" cx="150" cy="150" r="42" />

        <circle className="orb-dot orb-dot-1" r="4" />
        <circle className="orb-dot orb-dot-2" r="3" />
        <circle className="orb-dot orb-dot-3" r="2.5" />
      </svg>
    </div>
  );
}
