import cors from "cors";
import express from "express";
import { config } from "./config.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`server listening on http://localhost:${config.port}`);
});
