import { AuditPanel } from "./audit/AuditPanel";
import { useAuditEvents } from "./audit/useAuditEvents";
import { ChatPanel } from "./chat/ChatPanel";
import { GuardrailsBadge } from "./guardrails/GuardrailsBadge";
import { TrustRail } from "./trust/TrustRail";
import { GitHubIcon } from "./icons";
import { navigate } from "./router";
import { useTheme } from "./useTheme";
import "./App.css";

const sessionId = crypto.randomUUID();

export function Workspace() {
  const { theme, toggleTheme } = useTheme();
  const events = useAuditEvents(sessionId);

  return (
    <div className="app">
      <nav className="app-nav">
        <a className="app-brand" href="/" onClick={navigate("/")} title="Back to overview">
          <span className="app-mark" aria-hidden="true">
            ❖
          </span>
          <span className="app-name">Bazaar</span>
          <span className="app-slash">/agent</span>
        </a>
        <div className="app-nav-right">
          <GuardrailsBadge />
          <a
            className="app-icon"
            href="https://github.com/Dhruv-kys/BAZAAR"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            title="View source on GitHub"
          >
            <GitHubIcon />
          </a>
          <button
            className="app-theme"
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </nav>

      <TrustRail events={events} />

      <main className="app-grid">
        <ChatPanel sessionId={sessionId} />
        <AuditPanel events={events} sessionId={sessionId} />
      </main>
    </div>
  );
}
