import { useEffect, useState } from "react";
import { apiUrl } from "../api";

export interface AuditEvent {
  id: number;
  sessionId: string;
  timestamp: string;
  type: string;
  toolName: string | null;
  reasoning: string | null;
  payload: unknown;
  wasClamped: boolean;
}

export type StreamStatus = "connecting" | "live" | "offline";

export function useAuditEvents(sessionId: string): { events: AuditEvent[]; status: StreamStatus } {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    let cancelled = false;

    fetch(apiUrl(`/api/audit?sessionId=${sessionId}`))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setEvents(data);
      })
      .catch(() => {});

    const source = new EventSource(apiUrl("/api/audit/stream"));
    source.onopen = () => {
      if (!cancelled) setStatus("live");
    };
    source.onmessage = (message) => {
      const event: AuditEvent = JSON.parse(message.data);
      if (event.sessionId !== sessionId) return;
      setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]));
    };
    // EventSource retries on its own, so an error means "not connected right now",
    // not "give up". Reporting it is what keeps the LIVE badge honest.
    source.onerror = () => {
      if (!cancelled) setStatus(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [sessionId]);

  return { events, status };
}
