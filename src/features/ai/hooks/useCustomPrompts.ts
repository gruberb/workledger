import { useCallback, useEffect, useState } from "react";
import type { CustomPrompt } from "../types/ai.ts";
import { loadCustomPrompts, saveCustomPrompts } from "../storage/custom-prompts.ts";

export function useCustomPrompts() {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);

  useEffect(() => {
    let live = true;
    loadCustomPrompts()
      .then((loaded) => { if (live) setPrompts(loaded); })
      .catch((err) => console.warn("[ai] Could not load custom prompts:", err));
    return () => { live = false; };
  }, []);

  // Writes before updating state, so a failed write surfaces to the editor instead of a prompt that vanishes on reload.
  const savePrompt = useCallback(async (prompt: CustomPrompt) => {
    const next = prompts.some((p) => p.id === prompt.id)
      ? prompts.map((p) => (p.id === prompt.id ? prompt : p))
      : [...prompts, prompt];
    await saveCustomPrompts(next);
    setPrompts(next);
  }, [prompts]);

  const deletePrompt = useCallback(async (id: string) => {
    const next = prompts.filter((p) => p.id !== id);
    await saveCustomPrompts(next);
    setPrompts(next);
  }, [prompts]);

  return { prompts, savePrompt, deletePrompt };
}
