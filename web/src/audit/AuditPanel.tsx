import { useEffect, useState } from "react";

interface AuditEvent {
  id: number;
  sessionId: string;
  timestamp: string;
  type: string;
  toolName: string | null;
  reasoning: string | null;
  wasClamped: boolean;
}

export function AuditPanel({ sessionId }: { sessionId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    fetch(`/api/audit?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => {});

    const source = new EventSource("/api/audit/stream");
    source.onmessage = (message) => {
      const event: AuditEvent = JSON.parse(message.data);
      if (event.sessionId !== sessionId) return;
      setEvents((prev) => [...prev, event]);
    };

    return () => source.close();
  }, [sessionId]);

  return (
    <section>
      <h2>Audit Trail</h2>
      {events.length === 0 && <p>No decisions logged yet for this conversation.</p>}
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.type}</strong>
            {event.wasClamped && <span> [CLAMPED]</span>} - {event.reasoning}
          </li>
        ))}
      </ul>
    </section>
  );
}
