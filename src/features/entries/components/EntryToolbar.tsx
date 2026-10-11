import { useState, useCallback } from "react";
import type { EntryActions, WorkLedgerEntry } from "../types/entry.ts";
import { SIGNIFIER_CONFIG } from "../types/entry.ts";
import { formatTime } from "../../../utils/dates.ts";
import { ConfirmAction } from "../../../components/ui/ConfirmAction.tsx";
import { AIIcon, ArchiveIcon, CheckIcon, ExpandIcon, LinkIcon, PinIcon, RestoreIcon, TrashIcon } from "../../../components/ui/Icons.tsx";
import { SignifierPicker } from "./SignifierPicker.tsx";

const HOVER_BUTTON = "opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 dark:text-gray-600";

interface EntryToolbarProps {
  entry: WorkLedgerEntry;
  actions: EntryActions;
  isArchiveView?: boolean;
}

export function EntryToolbar({ entry, actions, isArchiveView }: EntryToolbarProps) {
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const { onSignifierChange, onPin, onUnpin, onFocus, onOpenAI, onArchive, onDelete, onUnarchive } = actions;

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}#entry-${entry.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [entry.id]);

  const cancel = () => setConfirming(null);
  const signifier = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;

  return (
    <div className="flex items-center gap-3 mb-2 px-1">
      <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">
        {formatTime(entry.createdAt)}
      </span>
      {isArchiveView && (
        <span className="text-[11px] text-amber-400 dark:text-amber-500 uppercase tracking-wider">
          archived
        </span>
      )}
      {onSignifierChange && !isArchiveView && (
        <SignifierPicker
          value={entry.signifier}
          onChange={(s) => onSignifierChange(entry.id, s)}
        />
      )}
      {isArchiveView && signifier && (
        <span className={`text-[11px] font-medium ${signifier.color}`}>{signifier.label}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {confirming === "archive" && (
          <ConfirmAction
            label="Archive?"
            onConfirm={() => { onArchive?.(entry.id); cancel(); }}
            onCancel={cancel}
          />
        )}
        {confirming === "delete" && (
          <ConfirmAction
            label="Delete forever?"
            onConfirm={() => { onDelete?.(entry.id); cancel(); }}
            onCancel={cancel}
            danger
          />
        )}

        {!confirming && !isArchiveView && (
          <>
            {(onPin || onUnpin) && (
              <button
                onClick={() => entry.isPinned ? onUnpin?.(entry.id) : onPin?.(entry.id)}
                className={`${entry.isPinned ? "opacity-100 text-orange-400" : "opacity-0 group-hover:opacity-100 max-sm:opacity-100 text-gray-300 dark:text-gray-600 hover:text-orange-400"} transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800`}
                title={entry.isPinned ? "Unpin entry" : "Pin to top"}
                aria-label={entry.isPinned ? "Unpin entry" : "Pin to top"}
              >
                <PinIcon filled={entry.isPinned} />
              </button>
            )}
            <button
              onClick={handleCopyLink}
              className={`${HOVER_BUTTON} hover:text-gray-500 dark:hover:text-gray-400`}
              title={linkCopied ? "Link copied!" : "Copy link to entry"}
              aria-label={linkCopied ? "Link copied" : "Copy link to entry"}
            >
              {linkCopied ? <CheckIcon /> : <LinkIcon />}
            </button>
            {onFocus && (
              <button
                onClick={() => onFocus(entry)}
                className={`${HOVER_BUTTON} hover:text-gray-500 dark:hover:text-gray-400`}
                title="Focus on this entry"
                aria-label="Focus on this entry"
              >
                <ExpandIcon />
              </button>
            )}
            {onOpenAI && (
              <button
                onClick={() => onOpenAI(entry)}
                className="opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity p-1 rounded hover:bg-orange-50 dark:hover:bg-orange-950 text-gray-300 dark:text-gray-600 hover:text-orange-500"
                title="Think with AI"
                aria-label="Think with AI"
              >
                <AIIcon />
              </button>
            )}
            {onArchive && (
              <button
                onClick={() => setConfirming("archive")}
                className={`${HOVER_BUTTON} hover:text-gray-500 dark:hover:text-gray-400`}
                title="Archive entry"
                aria-label="Archive entry"
              >
                <ArchiveIcon />
              </button>
            )}
          </>
        )}

        {!confirming && isArchiveView && onUnarchive && (
          <button
            onClick={() => onUnarchive(entry.id)}
            className={`${HOVER_BUTTON} hover:text-green-500`}
            title="Restore entry"
            aria-label="Restore entry"
          >
            <RestoreIcon />
          </button>
        )}

        {!confirming && onDelete && (
          <button
            onClick={() => setConfirming("delete")}
            className={`${HOVER_BUTTON} hover:text-red-400`}
            title="Delete entry permanently"
            aria-label="Delete entry permanently"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}
