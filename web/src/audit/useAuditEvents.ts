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

export function useAuditEvents(sessionId: string): AuditEvent[] {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(apiUrl(`/api/audit?sessionId=${sessionId}`))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setEvents(data);
      })
      .catch(() => {});

    const source = new EventSource(apiUrl("/api/audit/stream"));
    source.onmessage = (message) => {
      const event: AuditEvent = JSON.parse(message.data);
      if (event.sessionId !== sessionId) return;
      setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]));
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [sessionId]);

  return events;
}
