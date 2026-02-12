import { useState } from "react";
import type { WorkLedgerEntry } from "../../types/entry.ts";
import { formatTime, todayKey } from "../../utils/dates.ts";
import { EntryEditor } from "../editor/EntryEditor.tsx";
import { TagEditor } from "./TagEditor.tsx";

interface EntryCardProps {
  entry: WorkLedgerEntry;
  isLatest: boolean;
  onSave: (entry: WorkLedgerEntry) => Promise<void>;
  onTagsChange?: (entryId: string, dayKey: string, tags: string[]) => void;
  onArchive?: (id: string) => void;
}

export function EntryCard({ entry, isLatest, onSave, onTagsChange, onArchive }: EntryCardProps) {
  const isOld = entry.dayKey < todayKey();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="entry-card group animate-fade-in" id={`entry-${entry.id}`}>
      <div className="flex items-center gap-3 mb-1 px-1">
        <span className="text-xs text-gray-400 font-mono">
          {formatTime(entry.createdAt)}
        </span>
        {isOld && (
          <span className="text-[10px] text-gray-300 uppercase tracking-wider">
            past
          </span>
        )}
        {onArchive && (
          <div className="ml-auto">
            {confirmDelete ? (
              <span className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">Delete?</span>
                <button
                  onClick={() => {
                    onArchive(entry.id);
                    setConfirmDelete(false);
                  }}
                  className="text-[10px] text-red-500 hover:text-red-600 font-medium"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-[10px] text-gray-400 hover:text-gray-500"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500"
                title="Delete entry"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      {onTagsChange && (
        <div className="mb-2">
          <TagEditor
            tags={entry.tags ?? []}
            onChange={(tags) => onTagsChange(entry.id, entry.dayKey, tags)}
          />
        </div>
      )}
      <div
        className={`
          rounded-xl transition-all duration-200
          ${isOld ? "opacity-80" : ""}
        `}
      >
        <EntryEditor
          entry={entry}
          editable={true}
          onSave={onSave}
          autoFocus={isLatest && !isOld}
        />
      </div>
      <div className="entry-ruling mt-3 mb-6" />
    </div>
  );
}
