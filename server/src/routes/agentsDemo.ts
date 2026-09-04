import { Router } from "express";
import { runBuyerDemo, type DemoStep } from "../mcp/demoRun.js";
import { activeAgents } from "../mcp/presence.js";

export const agentsDemoRouter = Router();

agentsDemoRouter.get("/presence", (_req, res) => {
  const agents = activeAgents();
  res.json({ connected: agents.length > 0, agents });
});

agentsDemoRouter.get("/demo", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const send = (event: string, data: unknown) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runBuyerDemo((step: DemoStep) => send("step", step));
    send("done", { ok: true });
  } catch (error) {
    send("done", { ok: false, error: error instanceof Error ? error.message : "failed" });
  } finally {
    res.end();
  }
});
