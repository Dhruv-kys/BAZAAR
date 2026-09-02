import { Router, raw } from "express";
import { missingKeysFor } from "../config.js";
import { transcribeAudio } from "../voice/stt.js";
import { synthesizeSpeech } from "../voice/tts.js";

const MAX_SPOKEN_CHARS = 2000;

export const voiceRouter = Router();

const useBrowserTts = process.env.TTS_PROVIDER === "browser";

voiceRouter.get("/config", (_req, res) => {
  res.json({
    stt: missingKeysFor("stt").length === 0,
    tts: !useBrowserTts && missingKeysFor("tts").length === 0,
  });
});

voiceRouter.post("/transcribe", raw({ type: "audio/*", limit: "12mb" }), async (req, res) => {
  if (missingKeysFor("stt").length > 0) {
    res.status(503).json({ error: "Speech-to-text isn't configured. Add DEEPGRAM_API_KEY to .env and restart." });
    return;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: "Send raw audio bytes with an audio/* content type" });
    return;
  }

  try {
    const text = await transcribeAudio(req.body, req.headers["content-type"] ?? "audio/webm");
    res.json({ text });
  } catch (error) {
    console.error("transcription failed:", error);
    res.status(502).json({ error: "Transcription failed. Try again, or type instead." });
  }
});

voiceRouter.post("/speak", async (req, res) => {
  if (missingKeysFor("tts").length > 0) {
    res.status(503).json({ error: "Text-to-speech isn't configured. Add ELEVENLABS_API_KEY to .env and restart." });
    return;
  }
  const { text } = req.body ?? {};
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is a required string" });
    return;
  }

  try {
    const audio = await synthesizeSpeech(text.slice(0, MAX_SPOKEN_CHARS));
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (error) {
    console.error("speech synthesis failed:", error);
    res.status(502).json({ error: "Speech synthesis failed. The reply is still available as text." });
  }
});
