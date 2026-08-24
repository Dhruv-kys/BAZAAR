import { AuditPanel } from "./audit/AuditPanel";
import { ChatPanel } from "./chat/ChatPanel";
import { GuardrailsBadge } from "./guardrails/GuardrailsBadge";

const sessionId = crypto.randomUUID();

function App() {
  return (
    <main>
      <h1>Bazaar</h1>
      <GuardrailsBadge />
      <ChatPanel sessionId={sessionId} />
      <AuditPanel sessionId={sessionId} />
    </main>
  );
}

export default App;
