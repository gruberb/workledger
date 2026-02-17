export type ActionCategory = "summarize" | "generate" | "think" | "remember";
export type ActionScope = "entry" | "day" | "week" | "topic";

export interface AIAction {
  id: string;
  name: string;
  description: string;
  category: ActionCategory;
  scope: ActionScope;
  systemPrompt: string;
  userPromptTemplate: string;
  followUpSuggestions: string[];
}
