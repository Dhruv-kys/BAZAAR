import { Router } from "express";
import { SYSTEM_PROMPT } from "../agent/systemPrompt.js";
import { toolHandlers } from "../agent/toolHandlers.js";
import { toolDefinitions } from "../agent/tools.js";
import { missingKeysFor } from "../config.js";
import { humanActor } from "../commerce/actor.js";

const MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1";
const VOICE = process.env.OPENAI_REALTIME_VOICE ?? "cedar";
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const realtimeTools = toolDefinitions
  .filter((tool) => tool.type === "function")
  .map(({ function: fn }) => ({
    type: "function" as const,
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
  }));

export const realtimeRouter = Router();

/*
 * Which voice the shop speaks with, chosen rather than inferred.
 *
 * "realtime" is OpenAI speech-to-speech over WebRTC: interruptible, and its
 * tool calls come back through the same server code the typed path uses.
 * "turn" is the Deepgram/ElevenLabs path — record, transcribe, answer, speak.
 * Slower to reply, but nova-3 with language=multi handles Hindi/English
 * code-switching, which the realtime model does not do as well, and keyterms
 * from the catalog make it hear product names exactly.
 *
 * Reporting unavailable is how the client is told to take the turn-based path,
 * so this is the one switch that decides it.
 */
const VOICE_MODE = (process.env.VOICE_MODE ?? "realtime").toLowerCase();

realtimeRouter.get("/config", (_req, res) => {
  res.json({
    available: VOICE_MODE === "realtime" && missingKeysFor("chat").length === 0,
    mode: VOICE_MODE,
  });
});

realtimeRouter.post("/session", async (_req, res) => {
  if (VOICE_MODE !== "realtime") {
    res.status(503).json({ error: `Realtime voice is off; VOICE_MODE is "${VOICE_MODE}".` });
    return;
  }
  if (missingKeysFor("chat").length > 0) {
    res.status(503).json({ error: "Realtime voice isn't configured. Add OPENAI_API_KEY to .env and restart." });
    return;
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: MODEL,
          instructions: SYSTEM_PROMPT,
          audio: {
            input: { transcription: { model: "whisper-1" } },
            output: { voice: VOICE },
          },
          tools: realtimeTools,
          tool_choice: "auto",
        },
      }),
    });

    const body = await upstream.text();
    if (!upstream.ok) {
      console.error("realtime session mint failed:", upstream.status, body.slice(0, 400));
      res.status(502).json({ error: "Couldn't start a realtime voice session. Try again." });
      return;
    }

    const data = JSON.parse(body) as { value?: string; expires_at?: number };
    res.json({ clientSecret: data.value, expiresAt: data.expires_at, model: MODEL });
  } catch (error) {
    console.error("realtime session mint failed:", error);
    res.status(502).json({ error: "Couldn't start a realtime voice session. Try again." });
  }
});

realtimeRouter.post("/tool", (req, res) => {
  const { sessionId, name, args } = req.body ?? {};

  if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) {
    res.status(400).json({ error: "sessionId must be 8-64 characters of letters, digits or dashes" });
    return;
  }
  if (typeof name !== "string" || !Object.hasOwn(toolHandlers, name)) {
    res.status(400).json({ error: "unknown tool" });
    return;
  }

  const handler = toolHandlers[name];
  const result = handler(args ?? {}, { actor: humanActor(sessionId) });
  res.json(result);
});
