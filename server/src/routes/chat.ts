import { Router } from "express";
import { runChatTurn } from "../agent/agentCore.js";
import { AgentBusyError, AgentNotConfiguredError } from "../agent/llmClient.js";

function waitHint(seconds?: number): string {
  if (!seconds) return "in a moment";
  if (seconds < 90) return `in about ${Math.ceil(seconds)}s`;
  return `in about ${Math.ceil(seconds / 60)} min`;
}

const MAX_MESSAGE_CHARS = 2000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const { sessionId, message, budgetInPaise } = req.body ?? {};

  if (typeof sessionId !== "string" || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "sessionId and message are required strings" });
    return;
  }
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    res.status(400).json({ error: "sessionId must be 8-64 characters of letters, digits or dashes" });
    return;
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    res.status(400).json({ error: `Messages are limited to ${MAX_MESSAGE_CHARS} characters` });
    return;
  }

  try {
    // A budget is the customer's own bound. Trust it only as a number, and
    // only to tighten: the merchant cap still intersects it either way.
    const budget =
      typeof budgetInPaise === "number" && Number.isFinite(budgetInPaise) && budgetInPaise > 0
        ? Math.floor(budgetInPaise)
        : undefined;
    const result = await runChatTurn(sessionId, message, budget);
    res.json(result);
  } catch (error) {
    if (error instanceof AgentNotConfiguredError) {
      console.error("chat turn misconfigured:", error.message);
      res.status(503).json({ error: "The assistant isn't configured yet. Add OPENAI_API_KEY to .env and restart." });
      return;
    }
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
