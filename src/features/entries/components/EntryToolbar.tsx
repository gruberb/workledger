import { useState } from "react";
import { Menu } from "@mantine/core";
import type { EntryActions, WorkLedgerEntry } from "../types/entry.ts";
import { SIGNIFIER_CONFIG } from "../types/entry.ts";
import { formatTime } from "../../../utils/dates.ts";
import { ConfirmAction } from "../../../components/ui/ConfirmAction.tsx";
import { AIIcon, ArchiveIcon, CheckIcon, ChevronRightIcon, DownloadIcon, ExpandIcon, LinkIcon, PinIcon, RestoreIcon, TrashIcon } from "../../../components/ui/Icons.tsx";
import { SignifierPicker } from "./SignifierPicker.tsx";
import { copyEntryLink } from "../utils/entry-link.ts";

interface EntryToolbarProps {
  entry: WorkLedgerEntry;
  actions: EntryActions;
  isArchiveView?: boolean;
}

export function EntryToolbar({ entry, actions, isArchiveView }: EntryToolbarProps) {
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const { onSignifierChange, onPin, onUnpin, onFocus, onOpenAI, onArchive, onDelete, onUnarchive, onDownloadMarkdown } = actions;
  const signifier = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;

  const handleCopyLink = async () => {
    try {
      await copyEntryLink(entry.id);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <div className="entry-toolbar flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 px-1">
      <span className="text-xs text-[var(--color-notebook-muted)] font-mono">{formatTime(entry.createdAt)}</span>
      {isArchiveView && <span className="text-xs text-[var(--color-notebook-muted)]">Archived</span>}
      {onSignifierChange && !isArchiveView && (
        <SignifierPicker value={entry.signifier} onChange={(s) => onSignifierChange(entry.id, s)} />
      )}
      {isArchiveView && signifier && <span className={`text-xs font-medium ${signifier.color}`}>{signifier.label}</span>}
      <div className="ml-auto flex items-center gap-1">
        {confirming ? (
          <ConfirmAction
            label={confirming === "archive" ? "Archive?" : "Delete forever?"}
            onConfirm={() => {
              if (confirming === "archive") onArchive?.(entry.id);
              else onDelete?.(entry.id);
              setConfirming(null);
            }}
            onCancel={() => setConfirming(null)}
            danger={confirming === "delete"}
          />
        ) : (
          <>
            {!isArchiveView && onFocus && (
              <button className="entry-action" onClick={() => onFocus(entry)} title="Focus on this entry">
                <ExpandIcon /> <span>Focus</span>
              </button>
            )}
            {!isArchiveView && onOpenAI && (
              <button className="entry-action" onClick={() => onOpenAI(entry)} title="Think with AI">
                <AIIcon /> <span>Think with AI</span>
              </button>
            )}
            {/* Mantine handles keyboard navigation, portal positioning and focus return. */}
            <Menu position="bottom-end" offset={6} width={220} withinPortal zIndex={400} onOpen={() => setCopyStatus("idle")}>
              <Menu.Target>
                <button className="entry-action" aria-label="Entry actions">
                  {entry.isPinned && <PinIcon filled />}
                  <span>Entry actions</span><ChevronRightIcon className="rotate-90" size={12} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                {!isArchiveView && (onPin || onUnpin) && (
                  <Menu.Item leftSection={<PinIcon filled={entry.isPinned} />} onClick={() => entry.isPinned ? onUnpin?.(entry.id) : onPin?.(entry.id)}>
                    {entry.isPinned ? "Unpin entry" : "Pin to top"}
                  </Menu.Item>
                )}
                {!isArchiveView && (
                  <Menu.Item closeMenuOnClick={false} leftSection={copyStatus === "copied" ? <CheckIcon /> : <LinkIcon />} onClick={handleCopyLink}>
                    {copyStatus === "copied" ? "Link copied" : copyStatus === "failed" ? "Copy failed. Try again" : "Copy link to entry"}
                  </Menu.Item>
                )}
                {onDownloadMarkdown && <Menu.Item leftSection={<DownloadIcon />} onClick={() => onDownloadMarkdown(entry)}>Download Markdown</Menu.Item>}
                {!isArchiveView && onArchive && <Menu.Item leftSection={<ArchiveIcon />} onClick={() => setConfirming("archive")}>Archive entry</Menu.Item>}
                {isArchiveView && onUnarchive && <Menu.Item leftSection={<RestoreIcon />} onClick={() => onUnarchive(entry.id)}>Restore entry</Menu.Item>}
                {onDelete && <><Menu.Divider /><Menu.Item color="red" leftSection={<TrashIcon />} onClick={() => setConfirming("delete")}>Delete entry</Menu.Item></>}
              </Menu.Dropdown>
            </Menu>
          </>
        )}
      </div>
    </div>
  );
}
