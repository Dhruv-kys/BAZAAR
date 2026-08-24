import type OpenAI from "openai";

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const MAX_HISTORY_MESSAGES = 20;

const sessions = new Map<string, Message[]>();

export function getSessionMessages(sessionId: string): Message[] {
  let history = sessions.get(sessionId);
  if (!history) {
    history = [];
    sessions.set(sessionId, history);
  }
  return history;
}

export function trimHistory(history: Message[]): void {
  if (history.length <= MAX_HISTORY_MESSAGES) return;

  const hasSystem = history[0]?.role === "system";
  const start = hasSystem ? 1 : 0;

  let cut = history.length - MAX_HISTORY_MESSAGES;
  if (cut <= start) return;

  while (cut < history.length && history[cut].role !== "user") cut++;
  if (cut >= history.length) return;

  history.splice(start, cut - start);
}
