import cors from "cors";
import express from "express";
import { config, reportConfig } from "./config.js";
import { rateLimit, securityHeaders } from "./security.js";
import { auditRouter } from "./routes/audit.js";
import { chatRouter } from "./routes/chat.js";
import { guardrailsRouter } from "./routes/guardrails.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentsRouter } from "./routes/payments.js";
import { voiceRouter } from "./routes/voice.js";

const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(cors({ origin: ["http://localhost:5173", process.env.APP_ORIGIN].filter((o): o is string => Boolean(o)) }));

app.use("/api/payments", rateLimit(60, 60_000), paymentsRouter);

app.use(express.json({ limit: "64kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/chat", rateLimit(20, 60_000), chatRouter);
app.use("/api/guardrails", guardrailsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/orders", rateLimit(30, 60_000), ordersRouter);
app.use("/api/voice", rateLimit(30, 60_000), voiceRouter);

app.listen(config.port, () => {
  console.log(`server listening on http://localhost:${config.port}`);
  reportConfig();
});
