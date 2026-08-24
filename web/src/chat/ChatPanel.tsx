import { useEffect, useRef, useState } from "react";
import { OrderSummaryCard, type PendingOrder } from "../order/OrderSummaryCard";
import { AlertIcon } from "../icons";
import { RichText } from "./RichText";
import "./ChatPanel.css";

interface ChatMessage {
  role: "user" | "assistant" | "notice";
  content: string;
}

const STARTERS = [
  "A birthday cake for 15 people",
  "Something chocolate for an anniversary",
  "Cupcakes for an office party",
];

const PROOF_CHIPS = [
  { lead: "Caps", rest: "in code" },
  { lead: "Decisions", rest: "logged live" },
  { lead: "Razorpay", rest: "test mode" },
];

export function ChatPanel({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [orderSummary, setOrderSummary] = useState<PendingOrder | undefined>();
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, orderSummary]);

  async function send(text: string) {
    if (!text.trim() || sending) return;

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
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "notice", content: data.error ?? "Something went wrong." }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.orderSummary) setOrderSummary(data.orderSummary);
    } catch {
      setMessages((prev) => [...prev, { role: "notice", content: "Couldn't reach the server." }]);
    } finally {
      setSending(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <section className="cp">
      <div className={`cp-thread${empty && !sending ? " empty" : ""}`} ref={threadRef}>
        {empty ? (
          <div className="cp-intro">
            <span className="eyebrow">Merchant sales agent</span>
            <h1 className="cp-head">
              Tell it the occasion.
              <br />
              <em>It sells the rest.</em>
            </h1>
            <p className="cp-lede">
              A bakery assistant that recommends, cross-sells and upsells — then stops at a confirmation step before any
              money moves. Every decision is logged beside you.
            </p>
            <div className="cp-starters">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="cp-starter" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>

            <div className="cp-chips" aria-hidden="true">
              {PROOF_CHIPS.map((chip, i) => (
                <span key={chip.lead} className="cp-chip" style={{ animationDelay: `${i * 0.7}s` }}>
                  <i />
                  <strong>{chip.lead}</strong> {chip.rest}
                </span>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "notice" ? (
              <div key={i} className="cp-notice" role="status">
                <AlertIcon />
                {m.content}
              </div>
            ) : (
              <div key={i} className={`cp-msg ${m.role}`}>
                <span className="cp-who">{m.role === "user" ? "You" : "Agent"}</span>
                <div className="cp-bubble">
                  {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
                </div>
              </div>
            ),
          )
        )}

        {sending && (
          <div className="cp-msg assistant">
            <span className="cp-who">Agent</span>
            <div className="cp-bubble cp-thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {orderSummary && <OrderSummaryCard order={orderSummary} />}
      </div>

      <form
        className="cp-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="cp-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What are you shopping for?"
          aria-label="Message the sales agent"
        />
        <button className="cp-send" type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
