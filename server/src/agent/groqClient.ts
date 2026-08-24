import Groq from "groq-sdk";

export const CHAT_MODEL = "openai/gpt-oss-120b";

const MAX_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 8000;

export class AgentBusyError extends Error {
  readonly retryAfterSeconds?: number;

  constructor(retryAfterSeconds?: number) {
    super("The assistant is rate limited upstream");
    this.name = "AgentBusyError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let groq: Groq | undefined;

function getGroqClient(): Groq {
  groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
  return groq;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMalformedToolCall(error: unknown): boolean {
  if (!(error instanceof Groq.BadRequestError)) return false;
  const body = error.error as { error?: { code?: string } } | undefined;
  return body?.error?.code === "tool_use_failed";
}

export async function createChatCompletion(
  messages: Groq.Chat.Completions.ChatCompletionMessageParam[],
  tools: Groq.Chat.Completions.ChatCompletionTool[],
): Promise<Groq.Chat.Completions.ChatCompletion> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getGroqClient().chat.completions.create({
        model: CHAT_MODEL,
        messages,
        ...(tools.length ? { tools } : {}),
      });
    } catch (error) {
      if (!(error instanceof Groq.RateLimitError)) {
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
