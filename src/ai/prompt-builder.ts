import type { LLMMessage } from "./providers/types.ts";
import type { FrameworkStep } from "./frameworks/types.ts";
import type { AIMessage } from "../types/ai.ts";

export function buildMessages(
  step: FrameworkStep,
  noteContent: string,
  conversationHistory: AIMessage[],
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // System prompt from the framework step
  messages.push({
    role: "system",
    content: step.systemPrompt,
  });

  // First user message with note content
  const firstUserMessage = step.userPromptTemplate.replace(
    "{{noteContent}}",
    noteContent,
  );

  // If no conversation history, just send the first user message
  if (conversationHistory.length === 0) {
    messages.push({ role: "user", content: firstUserMessage });
    return messages;
  }

  // Add full conversation history
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}
