import { Router } from "express";
import { runBuyerDemo, type DemoStep } from "../mcp/demoRun.js";

export const agentsDemoRouter = Router();

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
