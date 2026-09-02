import type { StreamStatus } from "../audit/useAuditEvents";
import { GitHubIcon, MoonIcon, SunIcon } from "../icons";
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
}: {
  sessionId: string;
  stream: StreamStatus;
  theme: string;
  onToggleTheme: () => void;
}) {
  return (
    <header className="sb">
      <a className="sb-brand" href="/" onClick={navigate("/")} title="Back to overview">
        <span className="sb-mark" aria-hidden="true">
          ❖
        </span>
        <span className="sb-name">BAZAAR</span>
        <span className="sb-sub">Bakery sales agent</span>
      </a>

      <div className="sb-status">
        <span className={`sb-stream sb-stream-${stream}`}>
          <i aria-hidden="true" />
          {STREAM_COPY[stream]}
          <span className="sb-sr">audit stream {STREAM_COPY[stream]}</span>
        </span>
        <span className="sb-div" aria-hidden="true" />
        <span className="sb-mode">Test mode, no real money moves</span>
        <span className="sb-div" aria-hidden="true" />
        <span className="sb-session">
          session <b>{sessionId.slice(0, 8)}</b>
        </span>
      </div>

      <div className="sb-actions">
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
      </div>
    </header>
  );
}
