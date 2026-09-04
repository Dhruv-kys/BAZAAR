import type { ReactNode } from "react";
import "./Marginalia.css";

/* A drawn arrow rather than a glyph, so the aside reads as ink on paper. */
function Scribble() {
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" fill="none" aria-hidden="true">
      <path
        d="M1 8.4c4.2-3.1 8.9-5.4 13.9-6.1 3.1-.4 6.3.1 9.1 1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M20.2 1.4c1.4.6 2.7 1.4 3.8 2.4-1.4.7-2.6 1.7-3.6 2.9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="note">
      <Scribble />
      <span>{children}</span>
    </p>
  );
}
