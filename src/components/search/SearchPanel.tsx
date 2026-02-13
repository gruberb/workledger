import { useEffect, useRef } from "react";
import type { SearchIndexEntry } from "../../types/entry.ts";
import { formatDayKey } from "../../utils/dates.ts";

interface SearchPanelProps {
  isOpen: boolean;
  query: string;
  results: SearchIndexEntry[];
  onSearch: (query: string) => void;
  onClose: () => void;
  onResultClick: (entryId: string, dayKey: string) => void;
}

export function SearchPanel({
  isOpen,
  query,
  results,
  onSearch,
  onClose,
  onResultClick,
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in border border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-gray-400 shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search entries and tags..."
            className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
            autoComplete="off"
            data-1p-ignore
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
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
                onClick={() => {
                  onResultClick(result.entryId, result.dayKey);
                  onClose();
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="text-xs text-gray-400 mb-1">
                  {formatDayKey(result.dayKey)}
                </div>
                <div className="text-sm text-gray-600 line-clamp-2">
                  {snippet || <span className="italic text-gray-300">Empty entry</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
