export interface CodeLanguage {
  name: string;
  aliases?: string[];
}

// Maps a language from pasted HTML, markdown fences, imports or synced entries
// to a supported id. BlockNote's code block render throws on an unknown id
// (`\`\`\`http` once crashed the editor on paste), and its HTML parse keeps
// the raw class name without resolving aliases.
export function resolveCodeLanguage(
  language: string | undefined,
  supported: Record<string, CodeLanguage>,
  fallback: string,
): string {
  const wanted = language?.trim().toLowerCase();
  if (!wanted) return fallback;
  const match = Object.entries(supported).find(
    ([id, { aliases }]) => id.toLowerCase() === wanted || aliases?.some((alias) => alias.toLowerCase() === wanted),
  );
  return match?.[0] ?? fallback;
}
