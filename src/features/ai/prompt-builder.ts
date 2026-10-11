import type { LLMMessage } from "./providers/types.ts";
import type { AIMessage } from "./types/ai.ts";

/** The first history message already carries the note content (see renderUserPrompt). */
export function buildMessages(systemPrompt: string, history: AIMessage[]): LLMMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
  ];
}

export function renderUserPrompt(template: string, noteContent: string): string {
  return template.replace("{{noteContent}}", noteContent);
}
