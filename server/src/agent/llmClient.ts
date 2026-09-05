import { BadRequestError, OpenAI, RateLimitError } from "openai";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { missingKeysFor } from "../config.js";

export const CHAT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const MAX_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 8000;
const MAX_COMPLETION_TOKENS = 700;

export class AgentNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Missing required environment variable(s): ${missing.join(", ")}`);
    this.name = "AgentNotConfiguredError";
  }
}

export class AgentBusyError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(retryAfterSeconds?: number) {
    super("The assistant is rate limited upstream");
    this.name = "AgentBusyError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let client: OpenAI | undefined;

function getClient(): OpenAI {
  const missing = missingKeysFor("chat");
  if (missing.length) throw new AgentNotConfiguredError(missing);

  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  return client;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMalformedToolCall(error: unknown): boolean {
  return error instanceof BadRequestError;
}

/*
 * Warmth, bounded. The agent lives on tool calls, and past roughly 1.2 a
 * tool-calling model starts emitting arguments that do not parse — which this
 * client already retries, but a retry is a slower turn on a voice call. Money
 * is unaffected either way: pricing and limits are server-side, so temperature
 * changes how it talks, never what it is allowed to do.
 */
const TEMPERATURE = Math.min(1.4, Math.max(0, Number(process.env.OPENAI_TEMPERATURE ?? 1.15)));

export async function createChatCompletion(
  messages: ChatCompletionMessageParam[],
  tools: ChatCompletionTool[],
): Promise<ChatCompletion> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getClient().chat.completions.create({
        model: CHAT_MODEL,
        messages,
        temperature: TEMPERATURE,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        ...(tools.length ? { tools } : {}),
      });
    } catch (error) {
      if (!(error instanceof RateLimitError)) {
        if (isMalformedToolCall(error) && attempt < MAX_RETRIES) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        throw error;
      }

      const retryAfterSeconds = Number(error.headers?.get("retry-after"));
      const retryAfterMs = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : 2 ** attempt * 1000;

      if (retryAfterMs > MAX_RETRY_WAIT_MS || attempt >= MAX_RETRIES) {
        throw new AgentBusyError(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined);
      }

      await sleep(retryAfterMs);
    }
  }
}
