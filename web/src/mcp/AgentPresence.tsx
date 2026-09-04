import { useEffect, useState } from "react";
import { apiUrl } from "../api";
import "./AgentPresence.css";

interface AgentCall {
  tool: string;
  at: string;
}

interface Presence {
  agentId: string;
  firstSeen: string;
  lastSeen: string;
  calls: number;
  recent: AgentCall[];
}

const POLL_MS = 2000;

function since(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function AgentPresence() {
  const [agents, setAgents] = useState<Presence[]>([]);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let live = true;

    const read = async () => {
      try {
        const res = await fetch(apiUrl("/api/agents/presence"));
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as { agents: Presence[] };
        if (!live) return;
        setAgents(data.agents);
        setReachable(true);
      } catch {
        if (live) setReachable(false);
      }
    };

    read();
    const timer = setInterval(read, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  const connected = agents.length > 0;

  return (
    <div className={`ap${connected ? " is-live" : ""}`} aria-live="polite">
      <div className="ap-state">
        <span className="ap-dot" aria-hidden="true" />
        <strong>
          {!reachable
            ? "Merchant unreachable"
            : connected
              ? `${agents.length} agent${agents.length === 1 ? "" : "s"} at the door`
              : "No agent connected"}
        </strong>
        <span className="ap-hint">
          {connected
            ? "live, from the merchant's own session register"
            : "run the buyer, or the demo below, and this fills in"}
        </span>
      </div>

      {connected && (
        <ul className="ap-list">
          {agents.map((agent) => (
            <li key={agent.agentId}>
              <div className="ap-who">
                <code>{agent.agentId}</code>
                <span>
                  {agent.calls} call{agent.calls === 1 ? "" : "s"} &middot; last {since(agent.lastSeen)}
                </span>
              </div>
              {agent.recent.length > 0 && (
                <ol className="ap-calls">
                  {agent.recent.map((call, i) => (
                    <li key={`${call.at}-${i}`} className={i === 0 ? "is-newest" : undefined}>
                      {call.tool}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
