import { useState } from "react";
import { OrderSummaryCard, type PendingOrder } from "../order/OrderSummaryCard";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [orderSummary, setOrderSummary] = useState<PendingOrder | undefined>();

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : `Error: ${data.error}`;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (res.ok && data.orderSummary) {
        setOrderSummary(data.orderSummary);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't reach the server." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <div>
        {messages.map((m, i) => (
          <p key={i}>
            <strong>{m.role === "user" ? "You" : "Agent"}:</strong> {m.content}
          </p>
        ))}
        {sending && <p>Agent is thinking...</p>}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Ask about a cake for a birthday..."
      />
      <button type="button" onClick={sendMessage} disabled={sending}>
        Send
      </button>
      {orderSummary && <OrderSummaryCard order={orderSummary} />}
    </section>
  );
}
