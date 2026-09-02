import { useEffect, useRef, useState } from "react";
import { ApiUnavailableError, apiJson } from "../api";
import type { PendingOrder } from "../order/StagedOrder";
import { AlertIcon, CoinIcon, LockIcon, ShieldIcon, SpeakerIcon } from "../icons";
import type { CoinState } from "../landing/CoinScene";
import { RichText } from "./RichText";
import { VoiceCoin, Waveform } from "../voice/VoiceCoin";
import { useVoice } from "../voice/useVoice";
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
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!voice.micAvailable || voice.micStatus === "transcribing") return;
      event.preventDefault();
      voice.toggleMic(messages.length === 0 ? SPOKEN_GREETING : undefined);
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

  const coinState: CoinState =
    voice.micStatus === "recording"
      ? "listening"
      : sending || voice.micStatus === "transcribing"
        ? "thinking"
        : voice.isSpeaking
          ? "speaking"
          : "idle";

  const agentState =
    coinState === "listening"
      ? "Listening"
      : voice.micStatus === "transcribing"
        ? "Transcribing"
        : sending
          ? "Thinking"
          : voice.isSpeaking
            ? "Speaking"
            : "Ready";

  const micLabel =
    voice.micStatus === "recording"
      ? "Stop listening"
      : voice.isSpeaking
        ? "Interrupt and speak"
        : "Tap the coin to speak";

  const empty = messages.length === 0;

  return (
    <section className={`cp${empty ? " is-empty" : ""}`} aria-label="Conversation">
      {empty ? (
        <div className="cp-stage">
          <div className="cp-stage-inner">
            {voice.micAvailable ? (
              <VoiceCoin
                state={coinState}
                level={voice.level}
                size="hero"
                onClick={() => voice.toggleMic(empty ? SPOKEN_GREETING : undefined)}
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
              <Waveform state={coinState} level={voice.level} />
              <p className="cp-stage-hint">
                {voice.micAvailable ? (
                  <>
                    Tap the coin to speak <kbd>Space</kbd> or type below
                  </>
                ) : (
                  <>Type below to start &mdash; voice input is unavailable in this browser</>
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
          <Waveform state={coinState} level={voice.level} />
          <span>{agentState}</span>
        </div>
      )}

      <form
        className="cp-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        {voice.micAvailable && !empty && (
          <VoiceCoin
            state={coinState}
            level={voice.level}
            size="dock"
            onClick={voice.toggleMic}
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
