import { ENTRY_TEMPLATES, type EntryTemplate } from "../utils/templates.ts";
import { PlusIcon } from "../../../components/ui/Icons.tsx";

const ROW = "w-full text-left px-4 py-3 md:py-2.5 text-sm text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-2.5";
const ICON = "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-accent)] shrink-0";

interface TemplateMenuProps {
  onSelect: (template: EntryTemplate) => void;
  /** Adds a "Blank entry" row on top, for menus that replace the plain new-entry button. */
  onBlank?: () => void;
  /** Positioning, supplied by the caller. */
  className?: string;
}

export function TemplateMenu({ onSelect, onBlank, className = "" }: TemplateMenuProps) {
  return (
    <div className={`w-60 max-h-[65dvh] overflow-y-auto bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] rounded-lg shadow-lg ${className}`}>
      {onBlank && (
        <button
          onClick={onBlank}
          className={`${ROW} border-b border-[var(--color-notebook-border)]`}
        >
          <span className={ICON}><PlusIcon size={12} strokeWidth={3} /></span>
          Blank entry
        </button>
      )}
      {ENTRY_TEMPLATES.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className={ROW}
        >
          <span className={ICON}>
            {template.icon}
          </span>
          {template.name}
        </button>
      ))}
    </div>
  );
}
