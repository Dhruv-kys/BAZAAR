import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>Bazaar</h1>
      <p>server: {status}</p>
    </main>
  );
}

export default App;
