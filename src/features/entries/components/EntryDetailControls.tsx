import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { EntryActions, WorkLedgerEntry } from "../types/entry.ts";
import { EXPORT_FORMATS, SIGNIFIER_CONFIG } from "../types/entry.ts";
import { formatDayKey, formatTime } from "../../../utils/dates.ts";
import { getTagColor } from "../../../utils/tag-colors.ts";
import { ArchiveIcon, CheckIcon, CloseIcon, DownloadIcon, InfoIcon, LinkIcon, MoreIcon, PinIcon, RestoreIcon, TrashIcon } from "../../../components/ui/Icons.tsx";
import { copyEntryLink } from "../utils/entry-link.ts";
import { SignifierPicker } from "./SignifierPicker.tsx";
import { TagEditor } from "./TagEditor.tsx";

type Overlay = "info" | "actions" | null;

interface EntryDetailControlsProps {
  entry: WorkLedgerEntry;
  actions: EntryActions;
  isArchiveView?: boolean;
  /** Called after an action removed the entry from the current view (archive, restore, delete). */
  onGone: () => void;
}

const ROUND_BUTTON = "w-9 h-9 rounded-full border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-muted)] flex items-center justify-center shadow-sm active:bg-[var(--color-notebook-surface-alt)] transition-colors";

/** The ⓘ and ⋯ buttons of the full-screen entry, with their right panel and bottom sheet. */
export function EntryDetailControls({ entry, actions, isArchiveView, onGone }: EntryDetailControlsProps) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const close = () => setOverlay(null);

  return (
    <>
      <button onClick={() => setOverlay("info")} className={ROUND_BUTTON} title="Info" aria-label="Entry info">
        <InfoIcon size={18} />
      </button>
      <button onClick={() => setOverlay("actions")} className={ROUND_BUTTON} title="Actions" aria-label="Entry actions">
        <MoreIcon size={18} />
      </button>
      {/* Portaled: the sticky header is its own stacking context and would trap the overlays. */}
      {overlay && createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={overlay === "info" ? "Entry info" : "Entry actions"}>
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          {overlay === "info" ? (
            <InfoPanel entry={entry} actions={actions} isArchiveView={isArchiveView} onClose={close} />
          ) : (
            <ActionSheet entry={entry} actions={actions} isArchiveView={isArchiveView} onClose={close} onGone={onGone} />
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

interface PanelProps {
  entry: WorkLedgerEntry;
  actions: EntryActions;
  isArchiveView?: boolean;
  onClose: () => void;
}

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-notebook-muted)]">{label}</p>
      <div className="text-sm text-[var(--color-notebook-text)]">{children}</div>
    </div>
  );
}

function InfoPanel({ entry, actions, isArchiveView, onClose }: PanelProps) {
  const { onSignifierChange, onTagsChange } = actions;
  const signifier = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;

  return (
    <aside className="absolute top-0 right-0 bottom-0 w-[85%] max-w-sm bg-[var(--color-notebook-surface)] border-l border-[var(--color-notebook-border)] shadow-xl p-5 overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs uppercase tracking-wider font-medium text-[var(--color-notebook-muted)]">Info</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-notebook-muted)]" aria-label="Close info">
          <CloseIcon size={18} />
        </button>
      </div>
      <InfoField label="Created">{formatDayKey(entry.dayKey)}, {formatTime(entry.createdAt)}</InfoField>
      <InfoField label="Updated">{new Date(entry.updatedAt).toLocaleString()}</InfoField>
      <InfoField label="Signifier">
        {onSignifierChange && !isArchiveView ? (
          <SignifierPicker value={entry.signifier} onChange={(s) => onSignifierChange(entry.id, s)} />
        ) : signifier ? (
          <span className={`font-medium ${signifier.color}`}>{signifier.label}</span>
        ) : (
          <span className="text-[var(--color-notebook-muted)]">None</span>
        )}
      </InfoField>
      <InfoField label="Tags">
        {onTagsChange && !isArchiveView ? (
          <TagEditor tags={entry.tags ?? []} onChange={(tags) => onTagsChange(entry.id, tags)} />
        ) : entry.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>{tag}</span>
            ))}
          </div>
        ) : (
          <span className="text-[var(--color-notebook-muted)]">None</span>
        )}
      </InfoField>
    </aside>
  );
}

interface SheetRowProps {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

function SheetRow({ icon, label, danger, onClick }: SheetRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-3.5 text-[15px] text-left rounded-lg active:bg-[var(--color-notebook-surface-alt)] ${danger ? "text-red-500" : "text-[var(--color-notebook-text)]"}`}
    >
      <span className="w-5 flex justify-center">{icon}</span>
      {label}
    </button>
  );
}

function ActionSheet({ entry, actions, isArchiveView, onClose, onGone }: PanelProps & { onGone: () => void }) {
  const { onPin, onUnpin, onArchive, onUnarchive, onDelete, onDownload } = actions;
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const run = (action: () => void, { leaves = false } = {}) => {
    action();
    onClose();
    if (leaves) onGone();
  };

  const handleCopyLink = () => {
    copyEntryLink(entry.id).then(() => {
      setLinkCopied(true);
      setTimeout(onClose, 600);
    });
  };

  return (
    <div className="absolute left-0 right-0 bottom-0 bg-[var(--color-notebook-surface)] rounded-t-2xl shadow-2xl px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-[var(--color-notebook-border)]" />
      {confirming ? (
        <div className="py-3">
          <p className="px-2 pb-3 text-[15px] text-[var(--color-notebook-text)]">
            {confirming === "archive" ? "Archive this entry?" : "Delete this entry forever?"}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(null)} className="flex-1 py-3 rounded-lg border border-[var(--color-notebook-border)] text-[15px] text-[var(--color-notebook-text)]">
              Cancel
            </button>
            <button
              onClick={() => confirming === "archive"
                ? run(() => onArchive?.(entry.id), { leaves: true })
                : run(() => onDelete?.(entry.id), { leaves: true })}
              className={`flex-1 py-3 rounded-lg text-[15px] font-medium text-white ${confirming === "delete" ? "bg-red-500" : "bg-amber-500"}`}
            >
              {confirming === "archive" ? "Archive" : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {!isArchiveView && (
            <SheetRow
              icon={linkCopied ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
              label={linkCopied ? "Link copied" : "Copy link"}
              onClick={handleCopyLink}
            />
          )}
          {onDownload && EXPORT_FORMATS.map(({ format, label }) => (
            <SheetRow key={format} icon={<DownloadIcon size={18} />} label={label} onClick={() => run(() => onDownload(entry, format))} />
          ))}
          {!isArchiveView && (onPin || onUnpin) && (
            <SheetRow
              icon={<PinIcon size={18} filled={entry.isPinned} />}
              label={entry.isPinned ? "Unpin" : "Pin to top"}
              onClick={() => run(() => (entry.isPinned ? onUnpin?.(entry.id) : onPin?.(entry.id)))}
            />
          )}
          {!isArchiveView && onArchive && (
            <SheetRow icon={<ArchiveIcon size={18} />} label="Archive" onClick={() => setConfirming("archive")} />
          )}
          {isArchiveView && onUnarchive && (
            <SheetRow icon={<RestoreIcon size={18} />} label="Restore" onClick={() => run(() => onUnarchive(entry.id), { leaves: true })} />
          )}
          {onDelete && (
            <SheetRow icon={<TrashIcon size={18} />} label="Delete" danger onClick={() => setConfirming("delete")} />
          )}
        </>
      )}
    </div>
  );
}
