import { ENTRY_TEMPLATES, type EntryTemplate } from "../utils/templates.ts";

interface TemplateMenuProps {
  onSelect: (template: EntryTemplate) => void;
  /** Positioning, supplied by the caller. */
  className?: string;
}

export function TemplateMenu({ onSelect, className = "" }: TemplateMenuProps) {
  return (
    <div className={`w-52 bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] rounded-xl shadow-xl overflow-hidden ${className}`}>
      {ENTRY_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-2.5"
        >
          <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 shrink-0">
            {template.icon}
          </span>
          {template.name}
        </button>
      ))}
    </div>
  );
}
