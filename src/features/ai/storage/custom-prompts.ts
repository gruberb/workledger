import { z } from "zod";
import { getDB } from "../../../storage/db.ts";
import type { CustomPrompt } from "../types/ai.ts";

const KEY = "ai-prompts";

const customPromptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  instructions: z.string(),
  scope: z.enum(["entry", "day", "week", "ask"]),
  webSearch: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/** Keeps every valid prompt; a damaged row must not take the others down with it. */
export function parseCustomPrompts(raw: string | undefined): CustomPrompt[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = customPromptSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function loadCustomPrompts(): Promise<CustomPrompt[]> {
  const db = await getDB();
  return parseCustomPrompts((await db.get("settings", KEY))?.value);
}

export async function saveCustomPrompts(prompts: CustomPrompt[]): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: KEY, value: JSON.stringify(prompts) });
}
