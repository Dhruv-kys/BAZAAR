import type { StreamStatus } from "../audit/useAuditEvents";
import { GitHubIcon, MoonIcon, ShieldIcon, SunIcon } from "../icons";
import { navigate } from "../router";
import "./SystemBar.css";

const STREAM_COPY: Record<StreamStatus, string> = {
  live: "Connected",
  connecting: "Connecting",
  offline: "Not connected",
};

export function SystemBar({
  sessionId,
  stream,
  theme,
  onToggleTheme,
  started,
  eventCount,
  hasOrder,
  onOpenOrder,
  auditOpen,
  onToggleAudit,
  onReset,
}: {
  sessionId: string;
  stream: StreamStatus;
  theme: string;
  onToggleTheme: () => void;
  started: boolean;
  eventCount: number;
  hasOrder: boolean;
  onOpenOrder: () => void;
  auditOpen: boolean;
  onToggleAudit: () => void;
  onReset: () => void;
}) {
  return (
    <header className="sb">
      <a className="sb-brand" href="/" onClick={navigate("/")} title="Back to overview">
        <span className="sb-mark" aria-hidden="true">
          ❖
        </span>
        <span className="sb-name">BAZAAR</span>
        <span className="sb-slash">/agent</span>
        <span className={`sb-ready sb-ready-${stream}`}>
          <i aria-hidden="true" />
          {started ? STREAM_COPY[stream] : "READY"}
        </span>
      </a>

      <div className="sb-actions">
        <nav className="sb-links">
          <a href="/dashboard" onClick={navigate("/dashboard")}>
            Dashboard
          </a>
          <a href="/mcp" onClick={navigate("/mcp")}>
            MCP
          </a>
          <a href="/protocols" onClick={navigate("/protocols")}>
            Protocols
          </a>
        </nav>

        {started && (
          <button
            className={`sb-pill${auditOpen ? " is-on" : ""}`}
            type="button"
            aria-pressed={auditOpen}
            onClick={onToggleAudit}
          >
            Audit
            {eventCount > 0 && <b>{eventCount}</b>}
          </button>
        )}

        {hasOrder && (
          <button className="sb-pill sb-pill-order" type="button" onClick={onOpenOrder}>
            <ShieldIcon size={13} />
            Order
          </button>
        )}

        {started && (
          <span className="sb-session" title={sessionId}>
            {sessionId.slice(0, 8)}
          </span>
        )}

        <a
          className="sb-icon"
          href="https://github.com/Dhruv-kys/BAZAAR"
          target="_blank"
          rel="noreferrer"
          aria-label="View source on GitHub"
        >
          <GitHubIcon size={15} />
        </a>
        <button
          className="sb-icon"
          type="button"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <SunIcon size={14} /> : <MoonIcon size={14} />}
        </button>
        {started && (
          <button className="sb-new" type="button" onClick={onReset}>
            <span aria-hidden="true">+</span> New conversation
          </button>
        )}
      </div>
    </header>
  );
}
