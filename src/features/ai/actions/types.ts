export type ActionCategory = "research" | "summarize" | "generate" | "think" | "remember";
/** `ask`: a free-form question, with the targeted entry (if any) as context. */
export type ActionScope = "entry" | "day" | "week" | "topic" | "ask";

export interface AIAction {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  scope: ActionScope;
  systemPrompt: string;
  userPromptTemplate: string;
  followUpSuggestions: string[];
  /** Let the model search the web, when the provider supports it and the user allows it. */
  webSearch?: boolean;
}
