import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";

export type RealtimeStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking";

interface RealtimeEvents {
  onUserTranscript: (text: string) => void;
  onAgentTranscript: (text: string) => void;
  onToolResult: (name: string, result: unknown) => void;
  onNotice: (message: string) => void;
}

interface ServerEvent {
  type: string;
  transcript?: string;
  delta?: string;
  response?: {
    output?: { type?: string; name?: string; arguments?: string; call_id?: string }[];
  };
  error?: { message?: string };
}

export function useRealtimeVoice(sessionId: string, events: RealtimeEvents) {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [level, setLevel] = useState(0);
  const [available, setAvailable] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const frameRef = useRef(0);
  const eventsRef = useRef(events);
  const agentTextRef = useRef("");

  useEffect(() => {
    eventsRef.current = events;
  });

  useEffect(() => {
    fetch(apiUrl("/api/realtime/config"))
      .then((res) => (res.ok ? res.json() : { available: false }))
      .then((data: { available?: boolean }) => setAvailable(Boolean(data.available)))
      .catch(() => {});
    return () => stop();
  }, []);

  function meter(stream: MediaStream) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    ctx.createMediaStreamSource(stream).connect(analyser);
    ctxRef.current = ctx;
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(bins);
      let peak = 0;
      for (const bin of bins) peak = Math.max(peak, Math.abs(bin - 128) / 128);
      setLevel(Math.min(1, peak * 2.4));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  async function runTool(name: string, argsJson: string, callId: string) {
    let args: unknown = {};
    try {
      args = JSON.parse(argsJson || "{}");
    } catch {
      args = {};
    }

    let result: unknown;
    try {
      const res = await fetch(apiUrl("/api/realtime/tool"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name, args }),
      });
      result = await res.json();
    } catch {
      result = { ok: false, error: "The shop's server could not be reached." };
    }

    eventsRef.current.onToolResult(name, result);

    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: JSON.stringify(result) },
      }),
    );
    channel.send(JSON.stringify({ type: "response.create" }));
  }

  function handle(event: ServerEvent) {
    switch (event.type) {
      case "input_audio_buffer.speech_started":
        setStatus("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        setStatus("thinking");
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript?.trim()) eventsRef.current.onUserTranscript(event.transcript.trim());
        break;
      case "response.output_audio_transcript.delta":
        agentTextRef.current += event.delta ?? "";
        setStatus("speaking");
        break;
      case "response.output_audio_transcript.done":
        if (agentTextRef.current.trim()) eventsRef.current.onAgentTranscript(agentTextRef.current.trim());
        agentTextRef.current = "";
        break;
      case "response.done": {
        setStatus("listening");
        for (const item of event.response?.output ?? []) {
          if (item.type === "function_call" && item.name && item.call_id) {
            void runTool(item.name, item.arguments ?? "{}", item.call_id);
          }
        }
        break;
      }
      case "error":
        eventsRef.current.onNotice(event.error?.message ?? "The voice session hit an error.");
        break;
    }
  }

  async function start() {
    if (pcRef.current) return;
    setStatus("connecting");

    let token: string;
    try {
      const res = await fetch(apiUrl("/api/realtime/session"), { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) throw new Error(data.error ?? "no client secret");
      token = data.clientSecret;
    } catch {
      eventsRef.current.onNotice("Couldn't start the voice session. Type instead.");
      setStatus("idle");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      eventsRef.current.onNotice("Microphone access was denied. Allow it in the browser, or type instead.");
      setStatus("idle");
      return;
    }

    const pc = new RTCPeerConnection();
    pcRef.current = pc;
    streamRef.current = stream;

    const audio = new Audio();
    audio.autoplay = true;
    audioRef.current = audio;
    pc.ontrack = (event) => {
      audio.srcObject = event.streams[0];
    };

    for (const track of stream.getTracks()) pc.addTrack(track, stream);

    const channel = pc.createDataChannel("oai-events");
    channelRef.current = channel;
    channel.addEventListener("message", (message) => {
      try {
        handle(JSON.parse(message.data as string) as ServerEvent);
      } catch {
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    try {
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
        body: offer.sdp ?? "",
      });
      if (!answer.ok) throw new Error(await answer.text());
      await pc.setRemoteDescription({ type: "answer", sdp: await answer.text() });
    } catch {
      eventsRef.current.onNotice("Couldn't connect the voice session. Type instead.");
      stop();
      return;
    }

    meter(stream);
    setStatus("listening");
  }

  function stop() {
    cancelAnimationFrame(frameRef.current);
    void ctxRef.current?.close();
    ctxRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setLevel(0);
    setStatus("idle");
  }

  function toggle() {
    if (pcRef.current) stop();
    else void start();
  }

  return { available, status, level, toggle, stop, active: status !== "idle" };
}
