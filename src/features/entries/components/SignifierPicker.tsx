import { useState, useRef, useEffect } from "react";
import { SIGNIFIER_CONFIG, type EntrySignifier } from "../types/entry.ts";

interface SignifierPickerProps {
  value: EntrySignifier | undefined;
  onChange: (signifier: EntrySignifier | undefined) => void;
}

const SIGNIFIERS = Object.entries(SIGNIFIER_CONFIG) as [EntrySignifier, typeof SIGNIFIER_CONFIG[EntrySignifier]][];

export function SignifierPicker({ value, onChange }: SignifierPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const config = value ? SIGNIFIER_CONFIG[value] : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] transition-colors ${
          config
            ? `${config.color} hover:bg-gray-100 dark:hover:bg-gray-800`
            : "text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`}
        title={config ? `Signifier: ${config.label}` : "Add signifier"}
        aria-label={config ? `Signifier: ${config.label}` : "Add signifier"}
      >
        {config ? (
          <>
            <span className={`w-2 h-2 rounded-full bg-current`} />
            <span className="font-medium">{config.label}</span>
          </>
        ) : (
          <span className="w-2 h-2 rounded-full border border-current" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] rounded-lg shadow-xl py-1 z-50 w-32">
          {SIGNIFIERS.map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { onChange(key === value ? undefined : key); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-[var(--color-notebook-surface-alt)] ${
                key === value ? "font-medium" : ""
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cfg.color} ${key === value ? "bg-current" : "bg-current opacity-60"}`} />
              <span className={cfg.color}>{cfg.label}</span>
            </button>
          ))}
          {value && (
            <>
              <div className="border-t border-[var(--color-notebook-border)] my-1" />
              <button
                onClick={() => { onChange(undefined); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-[var(--color-notebook-surface-alt)] transition-colors"
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
