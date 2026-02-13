import { useState } from "react";
import type { WorkLedgerEntry } from "../../types/entry.ts";
import { formatTime, todayKey } from "../../utils/dates.ts";
import { EntryEditor } from "../editor/EntryEditor.tsx";
import { TagEditor } from "./TagEditor.tsx";

function ConfirmAction({ label, onConfirm, onCancel, danger }: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400">{label}</span>
      <button
        onClick={onConfirm}
        className={`text-[10px] font-medium ${danger ? "text-red-500 hover:text-red-600" : "text-amber-600 hover:text-amber-700"}`}
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        className="text-[10px] text-gray-400 hover:text-gray-500"
      >
        No
      </button>
    </span>
  );
}

interface EntryCardProps {
  entry: WorkLedgerEntry;
  isLatest: boolean;
  onSave: (entry: WorkLedgerEntry) => Promise<void>;
  onTagsChange?: (entryId: string, dayKey: string, tags: string[]) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  isArchiveView?: boolean;
  onOpenAI?: (entry: WorkLedgerEntry) => void;
}

export function EntryCard({ entry, isLatest, onSave, onTagsChange, onArchive, onDelete, onUnarchive, isArchiveView, onOpenAI }: EntryCardProps) {
  const isOld = entry.dayKey < todayKey();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="entry-card group animate-fade-in" id={`entry-${entry.id}`}>
      <div className="flex items-center gap-3 mb-2 px-1">
        <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">
          {formatTime(entry.createdAt)}
        </span>
        {isOld && !isArchiveView && (
          <span className="text-[11px] text-gray-300 dark:text-gray-600 uppercase tracking-wider">
            past
          </span>
        )}
        {isArchiveView && (
          <span className="text-[11px] text-amber-400 dark:text-amber-500 uppercase tracking-wider">
            archived
          </span>
        )}

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-1">
          {/* Think with AI button */}
          {onOpenAI && !isArchiveView && !confirmArchive && !confirmDelete && (
            <button
              onClick={() => onOpenAI(entry)}
              className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity p-1 rounded hover:bg-orange-50 dark:hover:bg-orange-950 text-gray-300 dark:text-gray-600 hover:text-orange-500"
              title="Think with AI"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
                <line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            </button>
          )}
          {/* Normal view: archive + delete */}
          {!isArchiveView && (confirmArchive || confirmDelete) ? (
            confirmArchive ? (
              <ConfirmAction
                label="Archive?"
                onConfirm={() => { onArchive?.(entry.id); setConfirmArchive(false); }}
                onCancel={() => setConfirmArchive(false)}
              />
            ) : (
              <ConfirmAction
                label="Delete forever?"
                onConfirm={() => { onDelete?.(entry.id); setConfirmDelete(false); }}
                onCancel={() => setConfirmDelete(false)}
                danger
              />
            )
          ) : !isArchiveView ? (
            <>
              {onArchive && (
                <button
                  onClick={() => setConfirmArchive(true)}
                  className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"
                  title="Archive entry"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 dark:text-gray-600 hover:text-red-400"
                  title="Delete entry permanently"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              )}
            </>
          ) : null}

          {/* Archive view: restore + delete */}
          {isArchiveView && confirmDelete ? (
            <ConfirmAction
              label="Delete forever?"
              onConfirm={() => { onDelete?.(entry.id); setConfirmDelete(false); }}
              onCancel={() => setConfirmDelete(false)}
              danger
            />
          ) : isArchiveView ? (
            <>
              {onUnarchive && (
                <button
                  onClick={() => onUnarchive(entry.id)}
                  className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 dark:text-gray-600 hover:text-green-500"
                  title="Restore entry"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 dark:text-gray-600 hover:text-red-400"
                  title="Delete entry permanently"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
      {onTagsChange && !isArchiveView && (
        <div className="mb-2">
          <TagEditor
            tags={entry.tags ?? []}
            onChange={(tags) => onTagsChange(entry.id, entry.dayKey, tags)}
          />
        </div>
      )}
      {isArchiveView && entry.tags?.length > 0 && (
        <div className="mb-2 px-1">
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      <div
        className={`
          rounded-xl transition-all duration-200
          ${isOld || isArchiveView ? "opacity-80" : ""}
        `}
      >
        <EntryEditor
          entry={entry}
          editable={!isArchiveView}
          onSave={onSave}
          autoFocus={isLatest && !isOld && !isArchiveView}
        />
      </div>
      <div className="entry-ruling mt-4 mb-8" />
    </div>
  );
}
