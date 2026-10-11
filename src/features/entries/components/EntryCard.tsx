import { useRef, memo } from "react";
import type { EntryActions, EntryEditorComponent, WorkLedgerEntry } from "../types/entry.ts";
import { TagEditor } from "./TagEditor.tsx";
import { EntryToolbar } from "./EntryToolbar.tsx";
import { ErrorBoundary } from "../../../components/ui/ErrorBoundary.tsx";
import { BacklinksPanel } from "./BacklinksPanel.tsx";
import { useNearViewport } from "../hooks/useNearViewport.ts";
import { useTodayKey } from "../../../hooks/useTodayKey.ts";
import { extractTitle, extractPreview } from "../utils/extract-title.ts";

interface EntryCardProps {
  entry: WorkLedgerEntry;
  isLatest: boolean;
  actions: EntryActions;
  Editor: EntryEditorComponent;
  isArchiveView?: boolean;
}

function EntryPlaceholder({ entry, height }: { entry: WorkLedgerEntry; height?: number }) {
  const title = extractTitle(entry);
  const preview = extractPreview(entry);
  return (
    <div className="px-12 py-4 min-h-[80px]" style={height ? { minHeight: height } : undefined}>
      <p className="text-base font-semibold text-[var(--color-notebook-text)]">{title}</p>
      {preview && (
        <p className="mt-1 text-sm text-[var(--color-notebook-muted)] line-clamp-2">{preview}</p>
      )}
    </div>
  );
}

// Default shallow memo: entries keep their object identity unless they changed,
// and `actions` / `Editor` are stable references from the app.
export const EntryCard = memo(function EntryCard({ entry, isLatest, actions, Editor, isArchiveView }: EntryCardProps) {
  const isOld = entry.dayKey < useTodayKey();
  const cardRef = useRef<HTMLDivElement>(null);
  const { near: nearViewport, lastHeight } = useNearViewport(cardRef);
  const { onTagsChange } = actions;

  return (
    <div ref={cardRef} className="entry-card group scroll-mt-[120px]" id={`entry-${entry.id}`}>
      <EntryToolbar entry={entry} actions={actions} isArchiveView={isArchiveView} />
      {onTagsChange && !isArchiveView && (
        <div className="mb-2">
          <TagEditor
            tags={entry.tags ?? []}
            onChange={(tags) => onTagsChange(entry.id, tags)}
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
      <div className={`rounded-xl transition-all duration-200 ${isArchiveView ? "opacity-80" : ""}`}>
        {nearViewport ? (
          <ErrorBoundary fallback={
            <div className="text-center py-8 text-sm text-[var(--color-notebook-muted)]">
              Editor failed to load.{" "}
              <button className="text-[var(--color-notebook-accent)] hover:underline" onClick={() => window.location.reload()}>Reload</button>
            </div>
          }>
            <Editor
              entry={entry}
              editable={!isArchiveView}
              onSave={actions.onSave}
              autoFocus={isLatest && !isOld && !isArchiveView}
            />
          </ErrorBoundary>
        ) : (
          <EntryPlaceholder entry={entry} height={lastHeight} />
        )}
      </div>
      <ErrorBoundary fallback={null}>
        <BacklinksPanel entryId={entry.id} />
      </ErrorBoundary>
      <div className="entry-ruling mt-4 mb-4" />
    </div>
  );
});
