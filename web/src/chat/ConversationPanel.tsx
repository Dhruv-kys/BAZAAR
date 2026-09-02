import { useEffect, useRef, useState } from "react";
import { ApiUnavailableError, apiJson } from "../api";
import type { PendingOrder } from "../order/StagedOrder";
import { AlertIcon, MicIcon, SpeakerIcon, SpeakerOffIcon } from "../icons";
import { RichText } from "./RichText";
import { useVoice } from "../voice/useVoice";
import "./ConversationPanel.css";

interface ChatMessage {
  role: "user" | "assistant" | "notice";
  content: string;
}

const STARTERS = [
  "A birthday cake for 15 people",
  "Something chocolate for an anniversary",
  "First order, can I get 50% off?",
];

export function ConversationPanel({
  sessionId,
  onOrderStaged,
}: {
  sessionId: string;
  onOrderStaged: (order: PendingOrder) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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
  }, [messages, sending]);

  async function send(text: string) {
    if (!text.trim() || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const { ok, data } = await apiJson<{ reply?: string; orderSummary?: PendingOrder; error?: string }>(
        "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text }),
        },
      );
      if (!ok || !data.reply) {
        setMessages((prev) => [...prev, { role: "notice", content: data.error ?? "The agent could not answer." }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      if (data.orderSummary) onOrderStaged(data.orderSummary);
      void voice.speak(data.reply);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "notice",
          content:
            err instanceof ApiUnavailableError
              ? "Backend unreachable. The agent service is not responding to this build."
              : "The request failed.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  const agentState = sending
    ? "Thinking"
    : voice.micStatus === "recording"
      ? "Listening"
      : voice.micStatus === "transcribing"
        ? "Transcribing"
        : "Ready";

  const empty = messages.length === 0;

  return (
    <section className="cp" aria-labelledby="cp-title">
      <div className="cp-head">
        <h2 className="cs-label" id="cp-title">
          Chat
        </h2>
        <span className={`cp-state cp-state-${agentState.toLowerCase()}`}>
          <i aria-hidden="true" />
          {agentState}
        </span>
      </div>

      <div className="cp-thread" ref={threadRef}>
        {empty ? (
          <div className="cp-intro">
            <h1 className="cp-lead">
              What are we
              <br />
              <em>baking today?</em>
            </h1>
            <p className="cp-sub">
              Tell me the occasion and I will put an order together. Nothing gets charged until you say so, and you can
              see every choice I make on the right.
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
                <AlertIcon size={14} />
                {m.content}
              </div>
            ) : (
              <div key={i} className={`cp-msg cp-${m.role}`}>
                <span className="cp-who">{m.role === "user" ? "Customer" : "Bazaar"}</span>
                <div className="cp-bubble">
                  {m.role === "assistant" ? <RichText text={m.content} /> : m.content}
                </div>
              </div>
            ),
          )
        )}

        {sending && (
          <div className="cp-msg cp-assistant">
            <span className="cp-who">Bazaar</span>
            <div className="cp-bubble cp-thinking" aria-label="Agent is reasoning">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
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
          placeholder={voice.micStatus === "transcribing" ? "Transcribing…" : "Message the agent"}
          aria-label="Message the sales agent"
        />
        {voice.micAvailable && (
          <button
            className={`cp-tool${voice.micStatus === "recording" ? " is-rec" : ""}`}
            type="button"
            disabled={voice.micStatus === "transcribing"}
            aria-label={voice.micStatus === "recording" ? "Stop recording" : "Speak instead of typing"}
            onClick={voice.toggleMic}
          >
            <MicIcon size={14} />
          </button>
        )}
        {voice.ttsAvailable && (
          <button
            className={`cp-tool${voice.speakReplies ? " is-on" : ""}`}
            type="button"
            aria-pressed={voice.speakReplies}
            aria-label={voice.speakReplies ? "Stop speaking replies aloud" : "Speak replies aloud"}
            onClick={voice.toggleSpeakReplies}
          >
            {voice.speakReplies ? <SpeakerIcon size={14} /> : <SpeakerOffIcon size={14} />}
          </button>
        )}
        <button className="cp-send" type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
