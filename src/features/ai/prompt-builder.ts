import type { LLMMessage } from "./providers/types.ts";
import type { AIMessage } from "./types/ai.ts";

interface PromptSource {
  systemPrompt: string;
  userPromptTemplate: string;
}

export function buildMessages(
  source: PromptSource,
  noteContent: string,
  conversationHistory: AIMessage[],
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // System prompt
  messages.push({
    role: "system",
    content: source.systemPrompt,
  });

  // First user message with note content
  const firstUserMessage = source.userPromptTemplate.replace(
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
