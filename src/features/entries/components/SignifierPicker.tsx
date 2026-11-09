import { useState, useRef, useCallback } from "react";
import { SIGNIFIER_CONFIG, type EntrySignifier } from "../types/entry.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";

interface SignifierPickerProps {
  value: EntrySignifier | undefined;
  onChange: (signifier: EntrySignifier | undefined) => void;
}

const SIGNIFIERS = Object.entries(SIGNIFIER_CONFIG) as [EntrySignifier, typeof SIGNIFIER_CONFIG[EntrySignifier]][];

export function SignifierPicker({ value, onChange }: SignifierPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, closeDropdown, open);

  const config = value ? SIGNIFIER_CONFIG[value] : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={config ? "sticker" : "sticker-ghost ghost"}
        data-signifier={value}
        title={config ? `Signifier: ${config.label}` : "Add signifier"}
        aria-label={config ? `Signifier: ${config.label}` : "Add signifier"}
        aria-expanded={open}
      >
        {config ? (
          <>
            <span aria-hidden="true">{value === "small-win" ? "✧" : value === "decision" ? "↗" : value === "question" ? "?" : value === "idea" ? "✦" : value === "milestone" ? "⚑" : "§"}</span>
            <span>{config.label}</span>
          </>
        ) : (
          <span>+ Signifier</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 bg-[var(--color-notebook-surface)] border-[1.5px] border-[var(--color-notebook-frame)] rounded-md shadow-[4px_4px_0_var(--color-notebook-lift)] p-1.5 z-50 w-40">
          {SIGNIFIERS.map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { onChange(key === value ? undefined : key); setOpen(false); }}
              className={`w-full text-left px-1.5 py-1 rounded flex items-center hover:bg-[var(--color-notebook-highlight)] ${
                key === value ? "bg-[var(--color-notebook-highlight)]" : ""
              }`}
            >
              <span className="sticker" data-signifier={key}>{cfg.label}</span>
            </button>
          ))}
          {value && (
            <>
              <div className="border-t border-[var(--color-notebook-border)] my-1" />
              <button
                onClick={() => { onChange(undefined); setOpen(false); }}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-[var(--color-notebook-muted)] hover:bg-[var(--color-notebook-surface-alt)]"
              >
                Remove signifier
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
