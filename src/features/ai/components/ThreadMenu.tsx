import { useCallback, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import type { AIConversation } from "../types/ai.ts";
import { listConversations, deleteConversation } from "../storage/ai-conversations.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { TrashIcon } from "../../../components/ui/Icons.tsx";

interface ThreadMenuProps {
  currentId?: string;
  /** Label for threads saved before titles existed. */
  fallbackTitle: (conversation: AIConversation) => string;
  onOpen: (conversation: AIConversation) => void;
  onDeleted: (id: string) => void;
}

function formatUpdated(timestamp: number): string {
  return isToday(timestamp) ? format(timestamp, "HH:mm") : format(timestamp, "MMM d");
}

/** Recent threads dropdown in the AI sidebar header. Reads the list each time it opens. */
export function ThreadMenu({ currentId, fallbackTitle, onOpen, onDeleted }: ThreadMenuProps) {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<AIConversation[] | null>(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const handleToggle = async () => {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    setError(false);
    try {
      setThreads(await listConversations());
    } catch {
      setError(true);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation(id);
      setThreads((prev) => prev?.filter((t) => t.id !== id) ?? null);
      onDeleted(id);
    } catch {
      setError(true);
    }
  };

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        onClick={handleToggle}
        className="p-1.5 rounded-md text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface)] transition-colors"
        title="Recent threads"
        aria-label="Recent threads"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] shadow-xl py-1 z-50">
          {error && <p role="alert" className="px-4 py-3 text-xs text-[var(--color-notebook-text)]">Could not load your threads. Try again.</p>}
          {!error && threads === null && <p className="px-4 py-3 text-xs text-[var(--color-notebook-muted)]">Loading…</p>}
          {!error && threads?.length === 0 && <p className="px-4 py-3 text-xs text-[var(--color-notebook-muted)]">No threads yet.</p>}
          {threads?.map((thread) => (
            <div
              key={thread.id}
              className={`group flex items-center gap-1 pr-2 hover:bg-[var(--color-notebook-surface-alt)] ${thread.id === currentId ? "bg-[var(--color-notebook-surface-alt)]" : ""}`}
            >
              <button
                onClick={() => { onOpen(thread); close(); }}
                className="flex-1 min-w-0 flex items-baseline gap-2 pl-4 py-2 text-left"
                aria-current={thread.id === currentId ? "true" : undefined}
              >
                <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-notebook-text)]">{thread.title ?? fallbackTitle(thread)}</span>
                <span className="shrink-0 text-[11px] text-[var(--color-notebook-muted)] tabular-nums">{formatUpdated(thread.updatedAt)}</span>
              </button>
              <button
                onClick={() => handleDelete(thread.id)}
                className="shrink-0 p-1 rounded text-[var(--color-notebook-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--color-notebook-text)] transition-opacity"
                aria-label={`Delete thread ${thread.title ?? fallbackTitle(thread)}`}
                title="Delete thread"
              >
                <TrashIcon size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
