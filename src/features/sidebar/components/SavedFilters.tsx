import { useState, useRef, useCallback } from "react";
import type { EntrySignifier } from "../../entries/index.ts";
import { SIGNIFIER_CONFIG } from "../../entries/index.ts";
import type { SavedFilter } from "../types/saved-filter.ts";
import { savedFilterMatches } from "../utils/saved-filters.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { CollapsibleSectionHeader } from "./CollapsibleSectionHeader.tsx";

interface SaveFilterButtonProps {
  onSave: (name: string) => void;
  savedFilters?: SavedFilter[];
  selectedTags?: string[];
  textQuery?: string;
  selectedSignifiers?: EntrySignifier[];
  variant?: "icon" | "text";
}

export function SaveFilterButton({ onSave, savedFilters, selectedTags = [], textQuery = "", selectedSignifiers = [], variant = "text" }: SaveFilterButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Check if current filters match an existing saved filter
  const matchingFilter = savedFilters?.find((f) =>
    savedFilterMatches(f, { tags: selectedTags, textQuery, signifiers: selectedSignifiers }),
  );

  const closePopover = useCallback(() => { setOpen(false); setName(""); }, []);
  useClickOutside(popoverRef, closePopover, open);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setOpen(false);
  };

  if (matchingFilter) {
    return (
      <span className={`flex items-center gap-1 shrink-0 ${variant === "icon" ? "text-orange-400" : "text-xs text-orange-400"}`} title={`Saved as "${matchingFilter.name}"`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {variant === "text" && <span>{matchingFilter.name}</span>}
      </span>
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1 shrink-0 transition-colors ${
          variant === "icon"
            ? "p-0.5 text-gray-400 hover:text-orange-500"
            : "text-xs text-gray-400 hover:text-orange-500"
        }`}
        title="Save current filter"
        aria-label="Save current filter"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {variant === "text" && <span>Save filter</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] rounded-lg shadow-xl p-3 z-50">
          <p className="text-[11px] text-[var(--color-notebook-muted)] mb-2">Save this filter as...</p>
          <input
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
            disabled={!name.trim()}
            className="w-full text-xs px-2.5 py-1.5 rounded bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

interface SavedFilterSectionProps {
  savedFilters: SavedFilter[];
  onApply: (filter: SavedFilter) => void;
  onDelete: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  selectedTags?: string[];
  textQuery?: string;
  selectedSignifiers?: EntrySignifier[];
}

export function SavedFilterSection({ savedFilters, onApply, onDelete, collapsed, onToggleCollapse, selectedTags = [], textQuery = "", selectedSignifiers = [] }: SavedFilterSectionProps) {
  if (savedFilters.length === 0) return null;

  const isExpanded = !collapsed;

  return (
    <div>
      <CollapsibleSectionHeader label="Saved Filters" count={savedFilters.length} expanded={isExpanded} onToggle={onToggleCollapse} />
      {isExpanded && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-1 mb-3">
          {savedFilters.map((filter) => {
            const isActive = savedFilterMatches(filter, { tags: selectedTags, textQuery, signifiers: selectedSignifiers });
            return (
              <button
                key={filter.id}
                onClick={() => onApply(filter)}
                className={`group relative px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 transition-opacity hover:opacity-80 ${
                  isActive ? "ring-2 ring-offset-1 ring-orange-400 dark:ring-orange-500" : ""
                }`}
                title={[
                  ...filter.tags.map((t) => `#${t}`),
                  ...filter.signifiers.map((sig) => SIGNIFIER_CONFIG[sig].label),
                  filter.textQuery ? `"${filter.textQuery}"` : "",
                ].filter(Boolean).join(" + ")}
              >
                {filter.name}
                <span
                  onClick={(e) => { e.stopPropagation(); onDelete(filter.id); }}
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-gray-300 dark:bg-gray-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-400 dark:hover:bg-red-500"
                  role="button"
                  aria-label={`Remove filter "${filter.name}"`}
                >
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
