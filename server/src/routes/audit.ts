import { Router } from "express";
import { auditEvents, getAuditEvents, getRecentAuditEvents, type AuditEvent } from "../audit/auditStore.js";
import { merchantMetrics, sessionImpact } from "../audit/impact.js";

export const auditRouter = Router();

auditRouter.get("/", (req, res) => {
  const { sessionId } = req.query;
  if (typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId query param is required" });
    return;
  }
  res.json(getAuditEvents(sessionId));
});

const METRICS_WINDOW = 5000;

auditRouter.get("/metrics", (_req, res) => {
  res.json(merchantMetrics(getRecentAuditEvents(METRICS_WINDOW)));
});

auditRouter.get("/impact", (req, res) => {
  const { sessionId } = req.query;
  if (typeof sessionId !== "string") {
    res.status(400).json({ error: "sessionId query param is required" });
    return;
  }
  res.json(sessionImpact(sessionId, getAuditEvents(sessionId)) ?? null);
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
