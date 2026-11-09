import { useRef, memo, Suspense, useLayoutEffect } from "react";
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
  /** Editor and backlinks only. The toolbar and tags live elsewhere (the mobile info panel and action sheet). */
  bare?: boolean;
}

function EntryPlaceholder({ entry, height }: { entry: WorkLedgerEntry; height?: number }) {
  const title = extractTitle(entry);
  const preview = extractPreview(entry);
  return (
    // Same type as the editor's title and body, so swapping in the editor barely moves the layout.
    <div className="min-h-[80px]" style={height ? { minHeight: height } : undefined}>
      <p className="text-[34px] leading-[40px] font-[750] tracking-[-0.032em] text-[var(--color-notebook-text)] max-md:text-[28px] max-md:leading-[34px]">{title}</p>
      {preview && (
        <p className="mt-2 text-[18px] leading-[30px] text-[var(--color-notebook-muted)] line-clamp-2">{preview}</p>
      )}
    </div>
  );
}

/**
 * Calls `onCommit` once its Suspense boundary has committed, i.e. once the lazy
 * editor next to it has rendered (or the error fallback that holds it).
 */
function CommitSignal({ onCommit }: { onCommit: () => void }) {
  useLayoutEffect(onCommit, [onCommit]);
  return null;
}

// Default shallow memo: entries keep their object identity unless they changed,
// and `actions` / `Editor` are stable references from the app.
export const EntryCard = memo(function EntryCard({ entry, isLatest, actions, Editor, isArchiveView, bare }: EntryCardProps) {
  const isOld = entry.dayKey < useTodayKey();
  const contentRef = useRef<HTMLDivElement>(null);
  const { near: nearViewport, height, onRendered } = useNearViewport(contentRef);
  const { onTagsChange } = actions;

  return (
    <div className="entry-card scroll-mt-[132px]" id={`entry-${entry.id}`}>
      {!bare && <EntryToolbar entry={entry} actions={actions} isArchiveView={isArchiveView} />}
      <div ref={contentRef} className={isArchiveView ? "opacity-80" : undefined}>
        {nearViewport ? (
          <ErrorBoundary fallback={
            <div className="text-center py-8 text-sm text-[var(--color-notebook-muted)]">
              Editor failed to load.{" "}
              <button className="text-[var(--color-notebook-accent)] hover:underline" onClick={() => window.location.reload()}>Reload</button>
              <CommitSignal onCommit={onRendered} />
            </div>
          }>
            {/* A lazy Editor may still be loading: keep the card's height and text meanwhile. */}
            <Suspense fallback={<EntryPlaceholder entry={entry} height={height} />}>
              <Editor
                entry={entry}
                editable={!isArchiveView}
                onSave={actions.onSave}
                autoFocus={isLatest && !isOld && !isArchiveView}
              />
              <CommitSignal onCommit={onRendered} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <EntryPlaceholder entry={entry} height={height} />
        )}
      </div>
      {!bare && onTagsChange && !isArchiveView && (
        <div className="mt-5">
          <TagEditor
            tags={entry.tags ?? []}
            onChange={(tags) => onTagsChange(entry.id, tags)}
          />
        </div>
      )}
      {!bare && isArchiveView && entry.tags?.length > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span key={tag} className="tag-chip">#{tag}</span>
            ))}
          </div>
        </div>
      )}
      <ErrorBoundary fallback={null}>
        <BacklinksPanel entryId={entry.id} />
      </ErrorBoundary>
    </div>
  );
});
