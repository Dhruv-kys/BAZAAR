import { useState } from "react";

export function DemoControls({ summaryId }: { summaryId: string }) {
  const [loading, setLoading] = useState(false);
  const [retryUrl, setRetryUrl] = useState<string>();
  const [error, setError] = useState<string>();

  async function simulateFailure() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/payments/${summaryId}/simulate-failure`, { method: "POST" });
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
    <div>
      <button type="button" onClick={simulateFailure} disabled={loading}>
        {loading ? "Simulating..." : "Force Simulate Failure (demo)"}
      </button>
      {retryUrl && (
        <p>
          Payment declined.{" "}
          <a href={retryUrl} target="_blank" rel="noreferrer">
            Retry payment →
          </a>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
