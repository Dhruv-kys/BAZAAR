import { Router } from "express";
import { GUARDRAILS } from "../guardrails/config.js";

export const guardrailsRouter = Router();

guardrailsRouter.get("/", (_req, res) => {
  res.json(GUARDRAILS);
});
