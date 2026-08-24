import Groq from "groq-sdk";

export const CHAT_MODEL = "openai/gpt-oss-120b";

const MAX_RETRIES = 3;

let groq: Groq | undefined;

function getGroqClient(): Groq {
  groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
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
      return await getGroqClient().chat.completions.create({ model: CHAT_MODEL, messages, tools });
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;

      if (isMalformedToolCall(error)) {
        await sleep(250 * (attempt + 1));
        continue;
      }

      if (!(error instanceof Groq.RateLimitError)) throw error;

      const retryAfterHeader = error.headers?.get("retry-after");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 2 ** attempt * 1000;
      await sleep(retryAfterMs);
    }
  }
}
