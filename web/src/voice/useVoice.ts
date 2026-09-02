import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";

const MAX_RECORDING_MS = 30000;
const SILENCE_HOLD_MS = 1500;
const SPEECH_LEVEL = 0.055;
const MIN_SPEECH_MS = 1200;

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

function preferredVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return undefined;
  const exact = voices.filter((voice) => voice.lang.replace("_", "-") === lang);
  if (exact.length > 0) {
    return exact.find((voice) => !voice.localService) ?? exact[0];
  }
  return voices.find((voice) => voice.lang.replace("_", "-").startsWith(lang.split("-")[0]));
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
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [level, setLevel] = useState(0);

  const voiceModeRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const stopTimerRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelFrameRef = useRef(0);
  const startMicRef = useRef<() => void>(() => {});
  const turnRef = useRef(0);
  const speakGuardRef = useRef<number | undefined>(undefined);
  const callbacksRef = useRef({ onTranscript, onNotice });

  useEffect(() => {
    callbacksRef.current = { onTranscript, onNotice };
  });

  useEffect(() => {
    fetch(apiUrl("/api/voice/config"))
      .then((res) => (res.ok ? res.json() : { stt: false, tts: false }))
      .then(setServerVoice)
      .catch(() => {});

    window.speechSynthesis?.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", onVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", onVoices);
      voiceModeRef.current = false;
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.abort();
      window.clearTimeout(stopTimerRef.current);
      cancelAnimationFrame(levelFrameRef.current);
      void audioCtxRef.current?.close();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const browserStt = typeof window !== "undefined" && Boolean(speechRecognitionCtor());
  const micAvailable = serverVoice.stt || browserStt;
  const ttsAvailable = serverVoice.tts || (typeof window !== "undefined" && "speechSynthesis" in window);

  function startMetering(stream: MediaStream, onSilence: () => void) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    const openedAt = performance.now();
    let heardSpeech = false;
    let lastLoud = openedAt;

    const tick = () => {
      const node = analyserRef.current;
      if (!node) return;
      node.getByteTimeDomainData(bins);
      let peak = 0;
      for (const bin of bins) peak = Math.max(peak, Math.abs(bin - 128) / 128);
      const amplitude = Math.min(1, peak * 2.4);
      setLevel(amplitude);

      const now = performance.now();
      if (amplitude > SPEECH_LEVEL) {
        heardSpeech = true;
        lastLoud = now;
      } else if (heardSpeech && now - lastLoud > SILENCE_HOLD_MS && now - openedAt > MIN_SPEECH_MS) {
        onSilence();
        return;
      }
      levelFrameRef.current = requestAnimationFrame(tick);
    };
    levelFrameRef.current = requestAnimationFrame(tick);
  }

  function stopMetering() {
    cancelAnimationFrame(levelFrameRef.current);
    analyserRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setLevel(0);
  }

  function endVoiceMode() {
    voiceModeRef.current = false;
    setVoiceMode(false);
  }

  function deliverTranscript(text: string) {
    if (text) {
      callbacksRef.current.onTranscript(text);
    } else {
      callbacksRef.current.onNotice("Didn't catch that. Tap the coin to try again, or type instead.");
      endVoiceMode();
    }
  }

  async function startServerMic() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      callbacksRef.current.onNotice("Microphone access was denied. Allow it in the browser, or type instead.");
      endVoiceMode();
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
      stopMetering();
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
          endVoiceMode();
        } else {
          deliverTranscript((data.text ?? "").trim());
        }
      } catch {
        callbacksRef.current.onNotice("Couldn't reach the server to transcribe. Try typing instead.");
        endVoiceMode();
      } finally {
        setMicStatus("idle");
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    startMetering(stream, () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    });
    setMicStatus("recording");
    stopTimerRef.current = window.setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, MAX_RECORDING_MS);
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
        endVoiceMode();
      } else if (event.error === "no-speech") {
        callbacksRef.current.onNotice("Didn't catch that. Tap the coin to try again, or type instead.");
        endVoiceMode();
      } else if (event.error !== "aborted") {
        callbacksRef.current.onNotice("Voice input failed. Try again, or type instead.");
        endVoiceMode();
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

  function startMic() {
    if (serverVoice.stt) void startServerMic();
    else startBrowserMic();
  }

  useEffect(() => {
    startMicRef.current = startMic;
  });

  function stopPlayback() {
    turnRef.current += 1;
    window.clearTimeout(speakGuardRef.current);
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }

  function toggleMic(greeting?: string) {
    if (micStatus === "transcribing") return;

    if (isSpeaking) {
      stopPlayback();
      voiceModeRef.current = true;
      setVoiceMode(true);
      startMic();
      return;
    }

    if (micStatus === "recording") {
      endVoiceMode();
      recorderRef.current?.stop();
      recognitionRef.current?.stop();
      return;
    }

    voiceModeRef.current = true;
    setVoiceMode(true);
    if (greeting) void speak(greeting);
    else startMic();
  }

  function finishSpeaking(token: number) {
    if (token !== turnRef.current) return;
    turnRef.current += 1;
    window.clearTimeout(speakGuardRef.current);
    audioRef.current = null;
    setIsSpeaking(false);
    if (voiceModeRef.current) startMicRef.current();
  }

  async function speak(text: string) {
    if (!voiceModeRef.current) return;
    const plain = stripForSpeech(text);
    if (!plain) {
      if (voiceModeRef.current) startMicRef.current();
      return;
    }

    stopPlayback();
    const token = turnRef.current;

    const guard = (ms: number) => {
      window.clearTimeout(speakGuardRef.current);
      speakGuardRef.current = window.setTimeout(() => finishSpeaking(token), ms);
    };

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
          const done = () => {
            URL.revokeObjectURL(url);
            finishSpeaking(token);
          };
          audio.onended = done;
          audio.onerror = done;
          audio.onloadedmetadata = () => guard((audio.duration || 30) * 1000 + 2500);
          audioRef.current = audio;
          setIsSpeaking(true);
          guard(45000);
          try {
            await audio.play();
          } catch {
            done();
          }
          return;
        }
      } catch {
      }
    }

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(plain);
      const voice = preferredVoice("en-IN");
      utterance.lang = "en-IN";
      if (voice) utterance.voice = voice;
      utterance.onend = () => finishSpeaking(token);
      utterance.onerror = () => finishSpeaking(token);
      setIsSpeaking(true);
      guard(plain.split(/\s+/).length * 420 + 6000);
      window.setTimeout(() => window.speechSynthesis.speak(utterance), 60);
      return;
    }

    finishSpeaking(token);
  }

  function stopVoiceMode() {
    endVoiceMode();
    stopPlayback();
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
  }

  return {
    micAvailable,
    ttsAvailable,
    micStatus,
    voiceMode,
    isSpeaking,
    level,
    toggleMic,
    stopVoiceMode,
    speak,
  };
}
