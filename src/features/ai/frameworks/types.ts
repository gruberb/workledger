export interface FrameworkStep {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  followUpSuggestions: string[];
}

export interface ThinkingFramework {
  id: string;
  name: string;
  author: string;
  description: string;
  icon: string;
  category: "analytical" | "creative" | "decision" | "strategic";
  steps: FrameworkStep[];
}
