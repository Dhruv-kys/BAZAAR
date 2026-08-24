import cors from "cors";
import express from "express";
import { config, reportConfig } from "./config.js";
import { auditRouter } from "./routes/audit.js";
import { chatRouter } from "./routes/chat.js";
import { guardrailsRouter } from "./routes/guardrails.js";
import { ordersRouter } from "./routes/orders.js";
import { paymentsRouter } from "./routes/payments.js";

const app = express();
app.use(cors());

app.use("/api/payments", paymentsRouter);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/chat", chatRouter);
app.use("/api/guardrails", guardrailsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/orders", ordersRouter);

app.listen(config.port, () => {
  console.log(`server listening on http://localhost:${config.port}`);
  reportConfig();
});
