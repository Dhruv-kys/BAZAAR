import { useEffect, useRef, useState } from "react";
import { OrderSummaryCard, type PendingOrder } from "../order/OrderSummaryCard";
import { AlertIcon, ArrowUpRightIcon, MicIcon, SpeakerIcon, SpeakerOffIcon } from "../icons";
import { RichText } from "./RichText";
import { useVoice } from "../voice/useVoice";
import "./ChatPanel.css";
import { apiUrl } from "../api";

interface ChatMessage {
  role: "user" | "assistant" | "notice";
  content: string;
}

const STARTERS = [
  "A birthday cake for 15 people",
  "Something chocolate for an anniversary",
  "Cupcakes for an office party",
];

export function ChatPanel({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [orderSummary, setOrderSummary] = useState<PendingOrder | undefined>();
  const threadRef = useRef<HTMLDivElement>(null);

  const voice = useVoice(
    (text) => {
      if (sending) setInput((prev) => (prev ? `${prev} ${text}` : text));
      else void send(text);
    },
    (message) => setMessages((prev) => [...prev, { role: "notice", content: message }]),
  );

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, orderSummary]);

  async function send(text: string) {
    if (!text.trim() || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(apiUrl("/api/chat"), {
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
      void voice.speak(data.reply);
    } catch {
      setMessages((prev) => [...prev, { role: "notice", content: "Couldn't reach the server." }]);
    } finally {
      setSending(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <section className="cp" data-reveal>
      <div className="cp-core">
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
            placeholder={voice.micStatus === "transcribing" ? "Transcribing…" : "What are you shopping for?"}
            aria-label="Message the sales agent"
          />
          {voice.micAvailable && (
            <button
              className={`cp-tool cp-mic${voice.micStatus === "recording" ? " rec" : ""}`}
              type="button"
              disabled={voice.micStatus === "transcribing"}
              aria-label={voice.micStatus === "recording" ? "Stop recording" : "Speak instead of typing"}
              title={voice.micStatus === "recording" ? "Stop recording" : "Speak instead of typing"}
              onClick={voice.toggleMic}
            >
              <MicIcon />
            </button>
          )}
          {voice.ttsAvailable && (
            <button
              className={`cp-tool${voice.speakReplies ? " on" : ""}`}
              type="button"
              aria-pressed={voice.speakReplies}
              aria-label={voice.speakReplies ? "Stop speaking replies aloud" : "Speak replies aloud"}
              title={voice.speakReplies ? "Stop speaking replies aloud" : "Speak replies aloud"}
              onClick={voice.toggleSpeakReplies}
            >
              {voice.speakReplies ? <SpeakerIcon /> : <SpeakerOffIcon />}
            </button>
          )}
          <button className="cp-send" type="submit" disabled={sending || !input.trim()}>
            <span className="cp-send-label">Send</span>
            <span className="cp-send-orb" aria-hidden="true">
              <ArrowUpRightIcon size={13} />
            </span>
          </button>
        </form>
      </div>
    </section>
  );
}
