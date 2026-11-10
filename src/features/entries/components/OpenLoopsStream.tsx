import { useCallback, useMemo, useState } from "react";
import { SIGNIFIER_CONFIG, type EntrySignifier } from "../types/entry.ts";
import { closeTask, type CloseMode, type OpenLoopBucket, type OpenLoopGroup } from "../utils/open-loops.ts";
import { useOpenLoops } from "../hooks/useOpenLoops.ts";
import { useEntriesActions } from "../context/EntriesContext.tsx";
import { formatDayKey } from "../../../utils/dates.ts";
import { CheckIcon, ChecklistIcon, CloseIcon } from "../../../components/ui/Icons.tsx";

interface OpenLoopsStreamProps {
  /** Sidebar tag filter: every tag must be on the note. */
  tags: string[];
  /** Sidebar signifier filter: the note must have one of them. */
  signifiers: EntrySignifier[];
  onEntryClick: (entryId: string) => void;
}

const QUESTION_KEY = "question";
const itemId = (entryId: string, key: string) => `${entryId}\u0000${key}`;

function formatAge(days: number): string {
  if (days === 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** Hides items being closed, and groups left with nothing open. */
function withoutClosing(buckets: OpenLoopBucket[], closing: Set<string>): OpenLoopBucket[] {
  if (closing.size === 0) return buckets;
  return buckets
    .map((bucket) => ({
      ...bucket,
      groups: bucket.groups
        .map((g) => ({
          ...g,
          tasks: g.tasks.filter((t) => !closing.has(itemId(g.entry.id, t.key))),
          isQuestion: g.isQuestion && !closing.has(itemId(g.entry.id, QUESTION_KEY)),
        }))
        .filter((g) => g.tasks.length > 0 || g.isQuestion),
    }))
    .filter((bucket) => bucket.groups.length > 0);
}

/**
 * Unchecked checklist items and open questions from every note. Done checks the
 * item, Drop strikes it through and leaves it unchecked, Answered removes the Question
 * signifier. All three change the note itself, so undoing is editing the note.
 */
export function OpenLoopsStream({ tags, signifiers, onEntryClick }: OpenLoopsStreamProps) {
  const loaded = useOpenLoops(useMemo(() => ({ tags, signifiers }), [tags, signifiers]));
  const { editEntryBlocks, updateEntrySignifier } = useEntriesActions();

  // Items hidden right away on click; they leave the list for good once the
  // reload after the write no longer lists them.
  const [closing, setClosing] = useState<Set<string>>(new Set());
  const [loadedFor, setLoadedFor] = useState(loaded);
  if (loadedFor !== loaded) {
    setLoadedFor(loaded);
    if (loaded && closing.size > 0) {
      const stillOpen = new Set<string>();
      for (const b of loaded) for (const g of b.groups) {
        for (const t of g.tasks) stillOpen.add(itemId(g.entry.id, t.key));
        if (g.isQuestion) stillOpen.add(itemId(g.entry.id, QUESTION_KEY));
      }
      setClosing(new Set([...closing].filter((id) => stillOpen.has(id))));
    }
  }

  const hide = useCallback((id: string, hidden: boolean) => {
    setClosing((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleClose = useCallback(async (entryId: string, key: string, mode: CloseMode) => {
    const id = itemId(entryId, key);
    hide(id, true);
    try {
      const written = await editEntryBlocks(entryId, (blocks) => closeTask(blocks, key, mode));
      // Not written: the item changed in the note since it was listed; show the current state.
      if (!written) hide(id, false);
    } catch (err) {
      console.error("[open-loops] could not update the note", err);
      hide(id, false);
    }
  }, [editEntryBlocks, hide]);

  const handleAnswered = useCallback(async (entryId: string) => {
    const id = itemId(entryId, QUESTION_KEY);
    hide(id, true);
    try {
      await updateEntrySignifier(entryId, undefined);
    } catch (err) {
      console.error("[open-loops] could not update the note", err);
      hide(id, false);
    }
  }, [updateEntrySignifier, hide]);

  if (!loaded) {
    return <p className="py-24 text-center text-sm text-[var(--color-notebook-muted)]">Collecting open items…</p>;
  }

  const buckets = withoutClosing(loaded, closing);
  const filtered = tags.length > 0 || signifiers.length > 0;

  // Same paper layout as the journal: each age bucket is a sheet, each note a slot in it.
  return (
    <div className="entry-stream pb-16">
      {buckets.length === 0 ? (
        <section className="day-sheet">
          <div className="day-head">
            <h2 className="text-[var(--color-notebook-text)] day-header-font">{filtered ? "Nothing open in the filtered notes" : "Nothing open"}</h2>
          </div>
          <div className="open-loop-empty">
            <ChecklistIcon size={40} strokeWidth={1.25} className="text-[var(--color-notebook-muted)]" />
            <p>Unchecked checklist items and notes marked Question show up here, from every note, oldest ones included.</p>
          </div>
        </section>
      ) : (
        buckets.map((bucket) => {
          const count = bucket.groups.reduce((n, g) => n + g.tasks.length + (g.isQuestion ? 1 : 0), 0);
          return (
            <section key={bucket.label} className="day-sheet" aria-label={bucket.label}>
              <div className="day-head">
                <h2 className="text-[var(--color-notebook-text)] day-header-font">{bucket.label}</h2>
                <span className="day-head-count">{count} open</span>
              </div>
              {bucket.groups.map((group) => (
                <div key={group.entry.id} className="entry-slot">
                  <LoopGroup group={group} onOpen={onEntryClick} onClose={handleClose} onAnswered={handleAnswered} />
                </div>
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}

interface LoopGroupProps {
  group: OpenLoopGroup;
  onOpen: (entryId: string) => void;
  onClose: (entryId: string, key: string, mode: CloseMode) => void;
  onAnswered: (entryId: string) => void;
}

/** One note, laid out like a folded journal entry, with its open items below the title. */
function LoopGroup({ group, onOpen, onClose, onAnswered }: LoopGroupProps) {
  const { entry, title, ageDays, tasks, isQuestion } = group;
  const signifier = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;

  return (
    <div className="open-loop-group">
      <div className="entry-folded-meta">
        <span className="entry-time" title={formatDayKey(entry.dayKey)}>{formatAge(ageDays)}</span>
        {signifier && <span className="sticker" data-signifier={entry.signifier}>{signifier.label}</span>}
      </div>
      <button onClick={() => onOpen(entry.id)} className="entry-folded-title open-loop-title" title="Open note">
        {title}
      </button>
      {entry.tags.length > 0 && (
        <div className="entry-folded-tags">
          {entry.tags.map((tag) => <span key={tag} className="tag-chip">#{tag}</span>)}
        </div>
      )}
      <ul className="open-loop-list">
        {tasks.map((task) => (
          <LoopItem
            key={task.key}
            text={task.text}
            actions={<>
              <ItemButton label="Done" title="Check it off in the note" onClick={() => onClose(entry.id, task.key, "done")}>
                <CheckIcon size={14} />
              </ItemButton>
              <ItemButton label="Drop" title="Won't do: strike it through in the note and leave the box empty" onClick={() => onClose(entry.id, task.key, "drop")}>
                <CloseIcon size={14} />
              </ItemButton>
            </>}
          />
        ))}
        {isQuestion && (
          <LoopItem
            text="Open question"
            muted
            actions={
              <ItemButton label="Answered" title="Remove the Question signifier" onClick={() => onAnswered(entry.id)}>
                <CheckIcon size={14} />
              </ItemButton>
            }
          />
        )}
      </ul>
    </div>
  );
}

interface LoopItemProps {
  text: string;
  muted?: boolean;
  actions: React.ReactNode;
}

function LoopItem({ text, muted, actions }: LoopItemProps) {
  return (
    <li className="open-loop-item">
      <span className={`open-loop-text ${muted ? "italic text-[var(--color-notebook-muted)]" : ""}`}>
        {text}
      </span>
      <span className="open-loop-actions">{actions}</span>
    </li>
  );
}

interface ItemButtonProps {
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ItemButton({ label, title, onClick, children }: ItemButtonProps) {
  return (
    <button onClick={onClick} title={title} className="entry-action gap-1">
      {children}
      <span>{label}</span>
    </button>
  );
}
