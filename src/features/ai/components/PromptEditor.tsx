import { useId, useState } from "react";
import type { CustomPrompt } from "../types/ai.ts";
import { generateId } from "../../../utils/id.ts";

const SCOPE_OPTIONS: Array<{ value: CustomPrompt["scope"]; label: string }> = [
  { value: "entry", label: "The attached note (runs right away)" },
  { value: "day", label: "Today's notes (runs right away)" },
  { value: "week", label: "This week's notes (runs right away)" },
  { value: "ask", label: "My next message, plus the attached note if any" },
];

interface PromptEditorProps {
  /** Omit to create a new prompt. */
  prompt?: CustomPrompt;
  onSave: (prompt: CustomPrompt) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onDone: () => void;
}

export function PromptEditor({ prompt, onSave, onDelete, onDone }: PromptEditorProps) {
  const [name, setName] = useState(prompt?.name ?? "");
  const [instructions, setInstructions] = useState(prompt?.instructions ?? "");
  const [scope, setScope] = useState<CustomPrompt["scope"]>(prompt?.scope ?? "entry");
  const [webSearch, setWebSearch] = useState(prompt?.webSearch ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const canSave = name.trim().length > 0 && instructions.trim().length > 0 && !busy;

  const run = async (task: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      onDone();
    } catch {
      setError(failure);
      setBusy(false);
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    const now = Date.now();
    void run(() => onSave({
      id: prompt?.id ?? `prompt-${generateId()}`,
      name: name.trim(),
      instructions: instructions.trim(),
      scope,
      webSearch,
      createdAt: prompt?.createdAt ?? now,
      updatedAt: now,
    }), "Could not save the prompt. Try again.");
  };

  const fieldClass = "w-full text-sm rounded-lg border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] px-3 py-2 outline-none focus:border-[var(--color-notebook-accent)] text-[var(--color-notebook-text)]";

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      <div>
        <label htmlFor={`${ids}-name`} className="block text-xs font-medium text-[var(--color-notebook-muted)] mb-1">Name</label>
        <input id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Design partner" className={fieldClass} autoFocus />
      </div>
      <div>
        <label htmlFor={`${ids}-instructions`} className="block text-xs font-medium text-[var(--color-notebook-muted)] mb-1">Instructions</label>
        <textarea
          id={`${ids}-instructions`}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={12}
          placeholder="You are a design partner. Ask one or two questions at a time about goals, non-goals and unknowns, then draft a brief…"
          className={`${fieldClass} resize-y font-mono text-xs leading-relaxed`}
        />
        <p className="mt-1 text-[11px] text-[var(--color-notebook-muted)]">Sent as the system prompt on every message in the thread. Long prompts cost tokens on each turn.</p>
      </div>
      <div>
        <label htmlFor={`${ids}-scope`} className="block text-xs font-medium text-[var(--color-notebook-muted)] mb-1">Runs on</label>
        <select id={`${ids}-scope`} value={scope} onChange={(e) => setScope(e.target.value as CustomPrompt["scope"])} className={fieldClass}>
          {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--color-notebook-text)]">
        <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} />
        Allow web search (when the provider supports it)
      </label>

      {error && <p role="alert" className="text-xs text-[var(--color-notebook-text)]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        <button onClick={handleSave} disabled={!canSave} className="px-3 py-1.5 text-sm rounded-lg notebook-primary disabled:opacity-40">
          {prompt ? "Save" : "Create prompt"}
        </button>
        <button onClick={onDone} className="px-3 py-1.5 text-sm rounded-lg text-[var(--color-notebook-muted)] hover:bg-[var(--color-notebook-surface)]">
          Cancel
        </button>
        {prompt && onDelete && (
          <button
            onClick={() => void run(() => onDelete(prompt.id), "Could not delete the prompt. Try again.")}
            disabled={busy}
            className="ml-auto px-3 py-1.5 text-sm rounded-lg text-red-700 dark:text-red-300 hover:bg-[var(--color-notebook-surface)]"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
