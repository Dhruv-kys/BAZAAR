import { Router } from "express";
import { runChatTurn } from "../agent/agentCore.js";

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
    console.error("chat turn failed:", error);
    res.status(500).json({ error: "The assistant is temporarily unavailable. Please try again." });
  }
});
