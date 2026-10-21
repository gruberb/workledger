import { useState, useRef, useCallback, useId } from "react";
import type { EntrySignifier } from "../../entries/index.ts";
import { SIGNIFIER_CONFIG } from "../../entries/index.ts";
import type { SavedFilter } from "../types/saved-filter.ts";
import { savedFilterMatches } from "../utils/saved-filters.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { CollapsibleSectionHeader } from "./CollapsibleSectionHeader.tsx";

interface SaveFilterButtonProps {
  onSave: (name: string) => void | Promise<void>;
  inline?: boolean;
  /** Icon only below the xl breakpoint, for tight bars like the app header. */
  compact?: boolean;
  savedFilters?: SavedFilter[];
  selectedTags?: string[];
  selectedSignifiers?: EntrySignifier[];
}

export function SaveFilterButton({ onSave, savedFilters, selectedTags = [], selectedSignifiers = [], inline = false, compact = false }: SaveFilterButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Check if current filters match an existing saved filter
  const matchingFilter = savedFilters?.find((f) =>
    savedFilterMatches(f, { tags: selectedTags, signifiers: selectedSignifiers }),
  );

  const closePopover = useCallback(() => { setOpen(false); setName(""); }, []);
  useClickOutside(popoverRef, closePopover, open);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed);
      setName("");
      setOpen(false);
    } catch {
      setError("Could not save the filter. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (matchingFilter) {
    return (
      <span className="flex items-center gap-1 shrink-0 text-xs text-[var(--color-notebook-accent)]" title={`Saved as "${matchingFilter.name}"`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span>{matchingFilter.name}</span>
      </span>
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2 py-2 rounded border border-[var(--color-notebook-border)] text-sm text-[var(--color-notebook-accent)] hover:bg-[var(--color-notebook-surface-alt)]"
        aria-expanded={open}
        title="Save current filter"
        aria-label="Save current filter"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span className={compact ? "hidden xl:inline" : undefined}>Save current filter</span>
      </button>

      {open && (
        <div className={`${inline ? "mt-2 w-full" : "absolute right-0 top-full mt-2 w-56 shadow-xl z-50"} bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] rounded-md p-3`}>
          <label htmlFor={inputId} className="block text-xs text-[var(--color-notebook-muted)] mb-2">Filter name</label>
          <input
            id={inputId}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setOpen(false); setName(""); } }}
            placeholder="Filter name"
            className="w-full text-xs bg-[var(--color-notebook-surface-alt)] border border-[var(--color-notebook-border)] rounded px-2 py-1.5 outline-none focus:border-orange-400 text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)] mb-2"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="w-full text-xs px-2.5 py-1.5 rounded notebook-primary disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save filter"}
          </button>
          {error && <p role="alert" className="mt-2 text-xs text-[var(--color-notebook-text)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

interface SavedFilterSectionProps {
  onSave: (name: string) => Promise<void>;
  savedFilters: SavedFilter[];
  onApply: (filter: SavedFilter) => void;
  onDelete: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  selectedTags?: string[];
  selectedSignifiers?: EntrySignifier[];
}

export function SavedFilterSection({ onSave, savedFilters, onApply, onDelete, collapsed, onToggleCollapse, selectedTags = [], selectedSignifiers = [] }: SavedFilterSectionProps) {

  const isExpanded = !collapsed;

  return (
    <div>
      <CollapsibleSectionHeader label="Saved Filters" count={savedFilters.length} expanded={isExpanded} onToggle={onToggleCollapse} />
      {isExpanded && (
        <div className="space-y-1 px-1 pt-1 mb-3">
          <div className="mb-3">
            {selectedTags.length > 0 || selectedSignifiers.length > 0 ? (
              <SaveFilterButton inline onSave={onSave} savedFilters={savedFilters} selectedTags={selectedTags} selectedSignifiers={selectedSignifiers} />
            ) : (
              <p className="text-xs leading-relaxed text-[var(--color-notebook-muted)]">Select tags or signifiers below, then save your selection here.</p>
            )}
          </div>
          {savedFilters.map((filter) => {
            const isActive = savedFilterMatches(filter, { tags: selectedTags, signifiers: selectedSignifiers });
            return (
              <div key={filter.id} className="flex items-center gap-1">
                <button
                  onClick={() => onApply(filter)}
                  aria-pressed={isActive}
                  className={`flex-1 min-w-0 text-left px-2 py-2 rounded text-sm break-words hover:bg-[var(--color-notebook-surface-alt)] ${
                    isActive ? "text-[var(--color-notebook-accent)] bg-[var(--color-notebook-surface-alt)] font-semibold" : "text-[var(--color-notebook-text)]"
                  }`}
                  title={[
                    ...filter.tags.map((t) => `#${t}`),
                    ...filter.signifiers.map((sig) => SIGNIFIER_CONFIG[sig].label),
                  ].join(" + ")}
                >
                  {filter.name}
                </button>
                <button
                  onClick={() => onDelete(filter.id)}
                  className="shrink-0 w-8 h-8 rounded flex items-center justify-center text-[var(--color-notebook-muted)] hover:bg-[var(--color-notebook-surface-alt)]"
                  aria-label={`Remove filter "${filter.name}"`}
                >
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="m18 6-12 12M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
