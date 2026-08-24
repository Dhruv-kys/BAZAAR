import { Router } from "express";
import { auditEvents, getAuditEvents, type AuditEvent } from "../audit/auditStore.js";

export const auditRouter = Router();

auditRouter.get("/", (req, res) => {
  const { sessionId } = req.query;
  if (typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId query param is required" });
    return;
  }
  res.json(getAuditEvents(sessionId));
});

auditRouter.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const onEvent = (event: AuditEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  auditEvents.on("event", onEvent);

  req.on("close", () => {
    auditEvents.off("event", onEvent);
  });
});
