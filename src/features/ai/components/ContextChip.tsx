import type { ReactNode } from "react";
import { CloseIcon } from "../../../components/ui/Icons.tsx";

interface ContextChipProps {
  label: string;
  icon?: ReactNode;
  /** Accent for the prompt, neutral for notes; same shape and remove button either way. */
  tone?: "neutral" | "accent";
  onRemove: () => void;
  removeLabel: string;
}

/** Something that goes along with the next message: a note or the picked prompt. */
export function ContextChip({ label, icon, tone = "neutral", onRemove, removeLabel }: ContextChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 max-w-full h-6 pl-2 pr-0.5 rounded-md border text-[11px] ${
        tone === "accent"
          ? "border-[var(--color-notebook-accent)] text-[var(--color-notebook-accent)] font-medium"
          : "border-[var(--color-notebook-border)] text-[var(--color-notebook-text)]"
      } bg-[var(--color-notebook-surface)]`}
    >
      {icon}
      <span className="truncate max-w-44" title={label}>{label}</span>
      <button
        onClick={onRemove}
        className="shrink-0 p-1 rounded text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)]"
        aria-label={removeLabel}
        title="Remove"
      >
        <CloseIcon size={10} strokeWidth={2.5} />
      </button>
    </span>
  );
}
