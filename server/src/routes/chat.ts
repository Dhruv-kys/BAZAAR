import { Router } from "express";
import { runChatTurn } from "../agent/agentCore.js";
import { AgentBusyError } from "../agent/groqClient.js";

function waitHint(seconds?: number): string {
  if (!seconds) return "in a moment";
  if (seconds < 90) return `in about ${Math.ceil(seconds)}s`;
  return `in about ${Math.ceil(seconds / 60)} min`;
}

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const { sessionId, message } = req.body ?? {};

  if (typeof sessionId !== "string" || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "sessionId and message are required strings" });
    return;
  }

  try {
    const result = await runChatTurn(sessionId, message);
    res.json(result);
  } catch (error) {
    if (error instanceof AgentBusyError) {
      console.error("chat turn rate limited:", error.message);
      res.status(429).json({
        error: `The assistant has hit its usage limit. Try again ${waitHint(error.retryAfterSeconds)}.`,
      });
      return;
    }
    console.error("chat turn failed:", error);
    res.status(500).json({ error: "The assistant is temporarily unavailable. Please try again." });
  }
});
