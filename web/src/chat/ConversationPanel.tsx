import { useEffect, useRef, useState } from "react";
import { ApiUnavailableError, apiJson } from "../api";
import type { PendingOrder } from "../order/StagedOrder";
import { AlertIcon, CoinIcon, LockIcon, ShieldIcon, SpeakerIcon } from "../icons";
import type { CoinState } from "../landing/CoinScene";
import { RichText } from "./RichText";
import { VoiceCoin, Waveform } from "../voice/VoiceCoin";
import { useVoice } from "../voice/useVoice";
import { useRealtimeVoice } from "../voice/useRealtimeVoice";
import "./ConversationPanel.css";

interface ChatMessage {
  role: "user" | "assistant" | "notice";
  content: string;
}

const STARTERS = [
  { icon: CoinIcon, text: "A birthday cake for 15 people" },
  { icon: ShieldIcon, text: "Something chocolate for an anniversary" },
  { icon: LockIcon, text: "First order, can I get 50% off?" },
];

const SPOKEN_GREETING = "Hi, you're through to Bazaar. What are we baking today?";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function ConversationPanel({
  sessionId,
  onOrderStaged,
  onStarted,
}: {
  sessionId: string;
  onOrderStaged: (order: PendingOrder) => void;
  onStarted: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef(false);

  const voice = useVoice(
    (text) => {
      if (sending) setInput((prev) => (prev ? `${prev} ${text}` : text));
      else void send(text);
    },
    (message) => setMessages((prev) => [...prev, { role: "notice", content: message }]),
  );

  const [budget, setBudget] = useState(0);

  const realtime = useRealtimeVoice(sessionId, {
    onUserTranscript: (text) => {
      onStarted();
      setMessages((prev) => [...prev, { role: "user", content: text }]);
    },
    onAgentTranscript: (text) => {
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    },
    onToolResult: (name, result) => {
      const staged = result as { ok?: boolean; result?: PendingOrder };
      if (name === "present_order_summary" && staged.ok && staged.result) onOrderStaged(staged.result);
    },
    onNotice: (message) => setMessages((prev) => [...prev, { role: "notice", content: message }]),
  });

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendRef = useRef(send);

  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (!ask) return;
    window.history.replaceState({}, "", window.location.pathname);
    void sendRef.current(ask);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, input, textarea, select, [role=button], [contenteditable]")) return;
      if (!micReady || voice.micStatus === "transcribing") return;
      event.preventDefault();
      startTalking();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function send(text: string) {
    if (!text.trim() || sending) return;

    onStarted();
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const { ok, data } = await apiJson<{ reply?: string; orderSummary?: PendingOrder; error?: string }>(
        "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text, budgetInPaise: budget > 0 ? budget * 100 : undefined }),
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

  const coinState: CoinState = realtime.active
    ? realtime.status === "speaking"
      ? "speaking"
      : realtime.status === "thinking" || realtime.status === "connecting"
        ? "thinking"
        : "listening"
    : voice.micStatus === "recording"
      ? "listening"
      : sending || voice.micStatus === "transcribing"
        ? "thinking"
        : voice.isSpeaking
          ? "speaking"
          : "idle";

  const coinLevel = realtime.active ? realtime.level : voice.level;

  const startTalking = () => {
    if (realtime.available) realtime.toggle();
    else voice.toggleMic(messages.length === 0 ? SPOKEN_GREETING : undefined);
  };

  const agentState = realtime.active
    ? realtime.status === "connecting"
      ? "Connecting"
      : realtime.status.charAt(0).toUpperCase() + realtime.status.slice(1)
    : coinState === "listening"
      ? "Listening"
      : voice.micStatus === "transcribing"
        ? "Transcribing"
        : sending
          ? "Thinking"
          : voice.isSpeaking
            ? "Speaking"
            : "Ready";

  const micLabel = realtime.active
    ? "End the call"
    : realtime.available
      ? "Tap the coin to talk"
      : voice.micStatus === "recording"
        ? "Stop listening"
        : voice.isSpeaking
          ? "Interrupt and speak"
          : "Tap the coin to speak";

  const micReady = realtime.available || voice.micAvailable;

  const empty = messages.length === 0;

  return (
    <section className={`cp${empty ? " is-empty" : ""}`} aria-label="Conversation">
      {empty ? (
        <div className="cp-stage">
          <div className="cp-stage-inner">
            {micReady ? (
              <VoiceCoin
                state={coinState}
                level={coinLevel}
                size="hero"
                onClick={startTalking}
                disabled={voice.micStatus === "transcribing"}
                label={micLabel}
              />
            ) : (
              <div className="cp-stage-coin-static" aria-hidden="true">
                <CoinIcon size={64} />
              </div>
            )}

            <h1 className="cp-greeting">
              {greeting()} &mdash;
              <br />
              <em>what are we baking?</em>
            </h1>

            <p className="cp-stage-sub">
              A sales agent that recommends, upsells with a reason, and stops at the limits the shop
              set. Nothing is charged until you confirm.
            </p>

            <ul className="cp-suggestions">
              {STARTERS.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <button type="button" onClick={() => send(text)}>
                    <Icon size={15} />
                    <span>{text}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="cp-stage-foot">
              <Waveform state={coinState} level={coinLevel} />
              <p className="cp-stage-hint">
                {micReady ? (
                  <>
                    Type what you need, or tap the coin to talk <kbd>Space</kbd>
                  </>
                ) : (
                  <>Type what you need to get started</>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="cp-thread" ref={threadRef}>
          {messages.map((m, i) =>
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
      )}

      {!empty && agentState !== "Ready" && (
        <div className={`cp-live cp-state-${agentState.toLowerCase()}`} role="status">
          <Waveform state={coinState} level={coinLevel} />
          <span>{agentState}</span>
        </div>
      )}

      <div className="cp-budget">
        <label htmlFor="cp-budget-input">
          <span>Budget</span>
          <strong>{budget > 0 ? `₹${budget.toLocaleString("en-IN")}` : "none set"}</strong>
        </label>
        <input
          id="cp-budget-input"
          type="range"
          min={0}
          max={5000}
          step={100}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          aria-describedby="cp-budget-note"
        />
        <p id="cp-budget-note">
          {budget > 0
            ? "The server holds the agent to this. It intersects the shop's own cap — whichever is tighter binds."
            : "Set one and the agent has to work inside it."}
        </p>
      </div>

      <form
        className="cp-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        {micReady && !empty && (
          <VoiceCoin
            state={coinState}
            level={coinLevel}
            size="dock"
            onClick={startTalking}
            disabled={voice.micStatus === "transcribing"}
            label={micLabel}
          />
        )}
        <input
          className="cp-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voice.micStatus === "transcribing" ? "Transcribing…" : "Message the agent"}
          aria-label="Message the sales agent"
        />
        {voice.voiceMode && (
          <button
            className="cp-tool is-on"
            type="button"
            aria-label="End voice conversation"
            onClick={voice.stopVoiceMode}
          >
            <SpeakerIcon size={14} />
          </button>
        )}
        <button className="cp-send" type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
