import { useEffect, useState } from "react";
import { AuditPanel } from "./audit/AuditPanel";
import { useAuditEvents } from "./audit/useAuditEvents";
import { ChatPanel } from "./chat/ChatPanel";
import { GuardrailsBadge } from "./guardrails/GuardrailsBadge";
import { TrustRail } from "./trust/TrustRail";
import "./App.css";

const sessionId = crypto.randomUUID();

type Theme = "light" | "dark";

function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("bazaar-theme") === "dark" ? "dark" : "light",
  );
  const events = useAuditEvents(sessionId);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("bazaar-theme", theme);
  }, [theme]);

  return (
    <div className="app">
      <nav className="app-nav">
        <div className="app-brand">
          <span className="app-mark" aria-hidden="true">
            ❖
          </span>
          <span className="app-name">Bazaar</span>
          <span className="app-slash">/agent</span>
        </div>
        <div className="app-nav-right">
          <GuardrailsBadge />
          <button
            className="app-theme"
            type="button"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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

export default App;
