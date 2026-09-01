import { useState } from "react";
import "./DemoControls.css";
import { apiUrl } from "../api";

export function DemoControls({ summaryId }: { summaryId: string }) {
  const [loading, setLoading] = useState(false);
  const [retryUrl, setRetryUrl] = useState<string>();
  const [error, setError] = useState<string>();

  async function simulateFailure() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(apiUrl(`/api/payments/${summaryId}/simulate-failure`), { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't simulate a failure.");
        return;
      }
      setRetryUrl(data.retryUrl);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dc">
      {retryUrl ? (
        <div className="dc-recovered">
          <div className="dc-recovered-head">
            <span className="dc-badge">Payment declined</span>
            <span className="dc-recovered-note">Handled. A fresh link is ready</span>
          </div>
          <a className="dc-retry" href={retryUrl} target="_blank" rel="noreferrer">
            Retry payment →
          </a>
        </div>
      ) : (
        <button className="dc-trigger" type="button" onClick={simulateFailure} disabled={loading}>
          {loading ? "Simulating…" : "Simulate a declined payment"}
        </button>
      )}
      {error && (
        <p className="dc-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
