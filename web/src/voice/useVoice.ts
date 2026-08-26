import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";

const MAX_RECORDING_MS = 30000;

interface VoiceConfig {
  stt: boolean;
  tts: boolean;
}

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function speechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function stripForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type MicStatus = "idle" | "recording" | "transcribing";

export function useVoice(onTranscript: (text: string) => void, onNotice: (message: string) => void) {
  const [serverVoice, setServerVoice] = useState<VoiceConfig>({ stt: false, tts: false });
  const [micStatus, setMicStatus] = useState<MicStatus>("idle");
  const [speakReplies, setSpeakReplies] = useState(false);
  const speakRepliesRef = useRef(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const stopTimerRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callbacksRef = useRef({ onTranscript, onNotice });

  useEffect(() => {
    callbacksRef.current = { onTranscript, onNotice };
  });

  useEffect(() => {
    fetch(apiUrl("/api/voice/config"))
      .then((res) => (res.ok ? res.json() : { stt: false, tts: false }))
      .then(setServerVoice)
      .catch(() => {});
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.abort();
      window.clearTimeout(stopTimerRef.current);
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const browserStt = typeof window !== "undefined" && Boolean(speechRecognitionCtor());
  const micAvailable = serverVoice.stt || browserStt;
  const ttsAvailable = serverVoice.tts || (typeof window !== "undefined" && "speechSynthesis" in window);

  function deliverTranscript(text: string) {
    if (text) {
      speakRepliesRef.current = true;
      setSpeakReplies(true);
      callbacksRef.current.onTranscript(text);
    } else {
      callbacksRef.current.onNotice("Didn't catch that — try again, or type instead.");
    }
  }

  async function startServerMic() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      callbacksRef.current.onNotice("Microphone access was denied. Allow it in the browser, or type instead.");
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      window.clearTimeout(stopTimerRef.current);
      recorderRef.current = null;
      setMicStatus("transcribing");

      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      try {
        const res = await fetch(apiUrl("/api/voice/transcribe"), {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
        });
        const data = await res.json();
        if (!res.ok) {
          callbacksRef.current.onNotice(data.error ?? "Transcription failed. Try typing instead.");
        } else {
          deliverTranscript((data.text ?? "").trim());
        }
      } catch {
        callbacksRef.current.onNotice("Couldn't reach the server to transcribe. Try typing instead.");
      } finally {
        setMicStatus("idle");
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setMicStatus("recording");
    stopTimerRef.current = window.setTimeout(() => recorder.stop(), MAX_RECORDING_MS);
  }

  function startBrowserMic() {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript)
        .join(" ")
        .trim();
      deliverTranscript(transcript);
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setMicStatus("idle");
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        callbacksRef.current.onNotice("Microphone access was denied. Allow it in the browser, or type instead.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        callbacksRef.current.onNotice("Voice input failed. Try again, or type instead.");
      } else if (event.error === "no-speech") {
        callbacksRef.current.onNotice("Didn't catch that — try again, or type instead.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setMicStatus("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setMicStatus("recording");
  }

  function toggleMic() {
    if (micStatus === "transcribing") return;
    if (micStatus === "recording") {
      recorderRef.current?.stop();
      recognitionRef.current?.stop();
      return;
    }
    if (serverVoice.stt) void startServerMic();
    else startBrowserMic();
  }

  function stopPlayback() {
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
  }

  async function speak(text: string) {
    if (!speakRepliesRef.current) return;
    const plain = stripForSpeech(text);
    if (!plain) return;

    stopPlayback();

    if (serverVoice.tts) {
      try {
        const res = await fetch(apiUrl("/api/voice/speak"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: plain }),
        });
        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audioRef.current = audio;
          await audio.play();
          return;
        }
      } catch {
        // fall through to the browser voice
      }
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(plain));
    }
  }

  function toggleSpeakReplies() {
    if (speakRepliesRef.current) stopPlayback();
    speakRepliesRef.current = !speakRepliesRef.current;
    setSpeakReplies(speakRepliesRef.current);
  }

  return { micAvailable, ttsAvailable, micStatus, speakReplies, toggleMic, toggleSpeakReplies, speak };
}
