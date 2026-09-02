import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { AuditEvent } from "../audit/useAuditEvents";
import { buildStages, type GateState, type StageState } from "./topologyModel";
import "./AgentTopology.css";

const TopologyScene = lazy(() => import("./TopologyScene"));

function readPalette(el: HTMLElement): Record<StageState, string> {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    idle: v("--ink-3", "#646d79"),
    active: v("--live", "#58a6ff"),
    bounded: v("--warn", "#d29922"),
    locked: v("--ink-3", "#646d79"),
    open: v("--ok", "#3fb950"),
  };
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function AgentTopology({ events, gate }: { events: AuditEvent[]; gate: GateState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [render3d, setRender3d] = useState(false);
  const [palette, setPalette] = useState<Record<StageState, string>>();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setPalette(readPalette(host));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !supportsWebGL() || typeof IntersectionObserver === "undefined") return;

    // Only pay for WebGL once the panel is actually on screen.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRender3d(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(host);

    const theme = new MutationObserver(() => setPalette(readPalette(host)));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      io.disconnect();
      theme.disconnect();
    };
  }, []);

  const stages = buildStages(events, gate);

  return (
    <section className="at" aria-labelledby="at-title">
      <div className="cs-gov-head">
        <h2 className="cs-label" id="at-title">
          How a sale flows
        </h2>
        <span className="at-legend">
          <i className="at-dot at-active" /> done
          <i className="at-dot at-bounded" /> limited
          <i className="at-dot at-open" /> unlocked
        </span>
      </div>

      <div className="at-stage" ref={hostRef}>
        {render3d && palette && (
          <>
            <Suspense fallback={null}>
              <TopologyScene stages={stages} palette={palette} />
            </Suspense>
            <div className="at-labels" aria-hidden="true">
              {stages.map((stage) => (
                <span
                  key={stage.key}
                  className={`at-label at-${stage.state}`}
                  style={{ left: `${stage.at[0] * 100}%`, top: `${stage.at[1] * 100}%` }}
                >
                  {stage.label}
                </span>
              ))}
            </div>
          </>
        )}

        <ol className={`at-fallback${render3d ? " is-hidden" : ""}`}>
          {stages.map((stage) => (
            <li key={stage.key} className={`at-step at-${stage.state}`}>
              <span className="at-step-label">{stage.label}</span>
              <span className="at-step-state">{stage.state}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="at-note">
        Payment stays out of reach until you approve it. The agent has no path to it.
      </p>
    </section>
  );
}
