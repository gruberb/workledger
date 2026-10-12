import { useEffect, useRef, useCallback, memo } from "react";
import type { SearchIndexEntry } from "../../entries/index.ts";
import { formatDayKey } from "../../../utils/dates.ts";
import { SearchIcon } from "../../../components/ui/Icons.tsx";

interface SearchPanelProps {
  isOpen: boolean;
  query: string;
  results: SearchIndexEntry[];
  onSearch: (query: string) => void;
  onClose: () => void;
  onResultClick: (entryId: string, dayKey: string) => void;
}

export const SearchPanel = memo(function SearchPanel({
  isOpen,
  query,
  results,
  onSearch,
  onClose,
  onResultClick,
}: SearchPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap: keep Tab within the dialog
  const handleKeyDownFocusTrap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search entries"
      onKeyDown={handleKeyDownFocusTrap}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-gray-100 dark:border-gray-700"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <SearchIcon size={18} className="text-gray-400 shrink-0" />
          <input
            // Focus during the opening tap's commit: iOS only shows the keyboard
            // for focus inside the user gesture, not after a timeout.
            autoFocus
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search entries and tags..."
            className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            autoComplete="off"
            aria-label="Search query"
            data-1p-ignore
          />
          <kbd className="max-md:hidden text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto" role="listbox" aria-label="Search results">
          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No entries found
            </div>
          )}
          {results.map((result) => {
            const snippet =
              result.plainText.length > 120
                ? result.plainText.slice(0, 120) + "..."
                : result.plainText;
            return (
              <button
                key={result.entryId}
                role="option"
                aria-selected={false}
                onClick={() => {
                  onResultClick(result.entryId, result.dayKey);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
              >
                <div className="text-xs text-gray-400 mb-1">
                  {formatDayKey(result.dayKey)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {snippet || <span className="italic text-gray-300">Empty entry</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
