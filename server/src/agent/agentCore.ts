import type { PendingOrder } from "../payments/pendingOrderStore.js";
import { createChatCompletion } from "./llmClient.js";
import { getSessionMessages, trimHistory } from "./session.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { toolDefinitions } from "./tools.js";
import { humanActor } from "../commerce/actor.js";
import { toolHandlers, type ToolContext, type ToolResult } from "./toolHandlers.js";

const MAX_TOOL_ROUNDS = 10;

export interface ChatTurnResult {
  reply: string;
  orderSummary?: PendingOrder;
}

export async function runChatTurn(
  sessionId: string,
  userMessage: string,
  budgetInPaise?: number,
): Promise<ChatTurnResult> {
  const history = getSessionMessages(sessionId);
  if (history.length === 0) {
    history.push({ role: "system", content: SYSTEM_PROMPT });
  }
  history.push({ role: "user", content: userMessage });
  trimHistory(history);

  let orderSummary: PendingOrder | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await createChatCompletion(history, toolDefinitions);
    const message = completion.choices[0].message;
    history.push(message);

    if (!message.tool_calls?.length) {
      return { reply: message.content ?? "", orderSummary };
    }

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;

      const result = runTool(toolCall.function.name, toolCall.function.arguments, { actor: humanActor(sessionId, budgetInPaise) });
      if (toolCall.function.name === "present_order_summary" && result.ok) {
        orderSummary = result.result as PendingOrder;
      }
      history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  const closing = await createChatCompletion(history, []);
  const closingMessage = closing.choices[0].message;
  history.push(closingMessage);

  return {
    reply: closingMessage.content?.trim() || "I'm having trouble completing that right now - could you try again?",
    orderSummary,
  };
}

function runTool(name: string, rawArgs: string, ctx: ToolContext): ToolResult {
  const handler = toolHandlers[name];
  if (!handler) return { ok: false, error: `Unknown tool: ${name}` };

  let args: unknown;
  try {
    args = JSON.parse(rawArgs);
  } catch {
    return { ok: false, error: "Arguments were not valid JSON" };
  }

  return handler(args, ctx);
}
