import type { LLMMessage } from "./providers/types.ts";
import type { AIMessage } from "./types/ai.ts";

/** The first history message already carries the note content (see renderUserPrompt). */
export function buildMessages(systemPrompt: string, history: AIMessage[]): LLMMessage[] {
  return [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => (msg.images?.length
      ? { role: msg.role, content: msg.content, images: msg.images }
      : { role: msg.role, content: msg.content })),
  ];
}

export function renderUserPrompt(template: string, noteContent: string): string {
  // A function replacer: a string one would expand "$&" or "$'" inside the note.
  return template.replace("{{noteContent}}", () => noteContent);
}
