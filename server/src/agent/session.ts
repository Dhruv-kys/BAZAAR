import type Groq from "groq-sdk";

type Message = Groq.Chat.Completions.ChatCompletionMessageParam;

const sessions = new Map<string, Message[]>();

export function getSessionMessages(sessionId: string): Message[] {
  let history = sessions.get(sessionId);
  if (!history) {
    history = [];
    sessions.set(sessionId, history);
  }
  return history;
}
