import type { AIAction } from "../actions/types.ts";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../actions/actions.ts";

interface PromptGalleryProps {
  actions: AIAction[];
  onSelect: (action: AIAction) => void;
  /** Edit a custom prompt. */
  onEdit: (id: string) => void;
  onNew: () => void;
}

/** Prompts as chips grouped by category, with "My prompts" first. */
export function PromptGallery({ actions, onSelect, onEdit, onNew }: PromptGalleryProps) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: actions.filter((a) => a.category === category),
  })).filter((g) => g.items.length > 0 || g.category === "mine");

  return (
    <div className="space-y-4">
      {groups.map(({ category, items }) => (
        <section key={category}>
          <h4 className="text-[11px] uppercase tracking-wider text-[var(--color-notebook-muted)] font-medium mb-2">
            {CATEGORY_LABELS[category]}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {items.map((action) => {
              return (
                <span key={action.id} className="inline-flex">
                  <button
                    onClick={() => onSelect(action)}
                    title={action.description}
                    className={`text-xs px-2.5 py-1.5 border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-text)] transition-colors hover:border-[var(--color-notebook-accent)] hover:text-[var(--color-notebook-accent)] ${category === "mine" ? "rounded-l-full pr-2" : "rounded-full"}`}
                  >
                    {action.name}
                  </button>
                  {category === "mine" && (
                    <button
                      onClick={() => onEdit(action.id)}
                      className="text-xs pl-1.5 pr-2.5 py-1.5 rounded-r-full border border-l-0 border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-accent)] transition-colors"
                      aria-label={`Edit prompt ${action.name}`}
                      title="Edit prompt"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                  )}
                </span>
              );
            })}
            {category === "mine" && (
              <button
                onClick={onNew}
                className="text-xs px-2.5 py-1.5 rounded-full border border-dashed border-[var(--color-notebook-border)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-accent)] hover:border-[var(--color-notebook-accent)] transition-colors"
              >
                + New prompt
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
