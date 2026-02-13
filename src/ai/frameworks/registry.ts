import type { ThinkingFramework } from "./types.ts";
import frameworksData from "./frameworks.json";

const frameworks: ThinkingFramework[] = frameworksData as ThinkingFramework[];

export function getAllFrameworks(): ThinkingFramework[] {
  return frameworks;
}

export function getFramework(id: string): ThinkingFramework | undefined {
  return frameworks.find((f) => f.id === id);
}

export function getFrameworksByCategory(category: ThinkingFramework["category"]): ThinkingFramework[] {
  return frameworks.filter((f) => f.category === category);
}
