import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { SIGNIFIER_CONFIG } from "../types/entry.ts";
import { extractTitle } from "../utils/extract-title.ts";
import { filterDays, summarizeWeek, type ReviewChip, type WeekSummary } from "../utils/review-weeks.ts";
import { useEntriesActions, useEntriesData } from "../context/EntriesContext.tsx";
import { useTodayKey } from "../../../hooks/useTodayKey.ts";
import { formatTime } from "../../../utils/dates.ts";
import { getTagColor } from "../../../utils/tag-colors.ts";
import { isoWeekDayKeys, isoWeekKey, nextIsoWeekKey, previousIsoWeekKey } from "../../../utils/weeks.ts";
import { CalendarIcon, ChevronRightIcon } from "../../../components/ui/Icons.tsx";

interface ReviewStreamProps {
  /** Entries to review (already narrowed by the sidebar filters). */
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  /** ISO week shown, e.g. "2026-W42". */
  weekKey: string;
  onWeekChange: (weekKey: string) => void;
  onEntryClick?: (entryId: string) => void;
  onOpenAI?: () => void;
}

const MAX_TAG_CHIPS = 8;

/**
 * Only recent days are in memory. Load the selected week's days on demand:
 * a few reads per week instead of a full scan. Each day is requested once, so a
 * day that turns out empty cannot trigger a reload loop.
 */
function useLoadWeek(weekKey: string) {
  const { dayKeys, entriesByDay } = useEntriesData();
  const { loadDay } = useEntriesActions();
  const requested = useRef(new Set<string>());

  useEffect(() => {
    const week = new Set(isoWeekDayKeys(weekKey));
    for (const dayKey of dayKeys) {
      if (!week.has(dayKey) || entriesByDay.has(dayKey) || requested.current.has(dayKey)) continue;
      requested.current.add(dayKey);
      loadDay(dayKey).catch((err) => console.error(`[review] could not load ${dayKey}`, err));
    }
  }, [weekKey, dayKeys, entriesByDay, loadDay]);

  // Week of the oldest day with notes; ‹ stops there.
  return useMemo(() => {
    if (dayKeys.length === 0) return null;
    return isoWeekKey(dayKeys.reduce((min, k) => (k < min ? k : min)));
  }, [dayKeys]);
}

export function ReviewStream({ entriesByDay, weekKey, onWeekChange, onEntryClick, onOpenAI }: ReviewStreamProps) {
  const today = useTodayKey();
  const earliestWeekKey = useLoadWeek(weekKey);
  const week = useMemo(() => summarizeWeek(entriesByDay, weekKey, today), [entriesByDay, weekKey, today]);

  // Every week change clears the chip, also when coming back to the week it was picked in.
  const [chip, setChip] = useState<ReviewChip>(null);
  const [chipWeekKey, setChipWeekKey] = useState(weekKey);
  if (chipWeekKey !== weekKey) {
    setChipWeekKey(weekKey);
    setChip(null);
  }
  const days = useMemo(() => filterDays(week.days, chip), [week.days, chip]);

  if (!earliestWeekKey) {
    return (
      <div className="flex flex-col items-center text-center py-24">
        <CalendarIcon size={48} strokeWidth={1} className="text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-400 dark:text-gray-500">No entries to review</p>
      </div>
    );
  }

  const currentWeekKey = isoWeekKey(today);

  return (
    <div className="entry-stream pb-16">
      <WeekNav
        week={week}
        onPrev={weekKey > earliestWeekKey ? () => onWeekChange(previousIsoWeekKey(weekKey)) : undefined}
        onNext={weekKey < currentWeekKey ? () => onWeekChange(nextIsoWeekKey(weekKey)) : undefined}
      />

      {week.entryCount === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--color-notebook-muted)]">No notes this week</p>
      ) : (
        <>
          <WeekChips week={week} chip={chip} onChange={setChip} />

          <div className="space-y-5">
            {days.map((day) => (
              <section key={day.dayKey}>
                <h3 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-notebook-muted)]">
                  {day.dayLabel}
                </h3>
                <div className="divide-y divide-[var(--color-notebook-border)] border-y border-[var(--color-notebook-border)]">
                  {day.entries.map((entry) => (
                    <ReviewEntryRow key={entry.id} entry={entry} onClick={onEntryClick} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {onOpenAI && (
            <button
              onClick={onOpenAI}
              className="mt-6 px-1 inline-flex items-center gap-1.5 text-xs text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a6 6 0 0 1 6 6c0 3-2 5-3 6.5S13 17 13 19h-2c0-2-1-3-2-4.5S6 11 6 8a6 6 0 0 1 6-6z" />
                <line x1="10" y1="22" x2="14" y2="22" />
              </svg>
              Summarize with AI
            </button>
          )}
        </>
      )}
    </div>
  );
}

const NAV_BUTTON = "w-9 h-9 rounded-full border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] flex items-center justify-center shadow-sm transition-colors shrink-0 disabled:opacity-30 disabled:pointer-events-none";

interface WeekNavProps {
  week: WeekSummary;
  /** Omitted at the oldest week with notes. */
  onPrev?: () => void;
  /** Omitted at the current week. */
  onNext?: () => void;
}

function WeekNav({ week, onPrev, onNext }: WeekNavProps) {
  return (
    <div className="sticky top-0 sticky-header flex items-center gap-3 px-1 py-3 mb-4">
      <button onClick={onPrev} disabled={!onPrev} className={NAV_BUTTON} aria-label="Previous week" title="Previous week">
        <ChevronRightIcon size={18} className="rotate-180" />
      </button>
      <div className="flex-1 min-w-0 text-center">
        <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-[var(--color-notebook-text)] truncate">{week.label}</h2>
        <p className="text-xs text-[var(--color-notebook-muted)]">
          {week.dateRange} · {week.entryCount} {week.entryCount === 1 ? "note" : "notes"}
        </p>
      </div>
      <button onClick={onNext} disabled={!onNext} className={NAV_BUTTON} aria-label="Next week" title="Next week">
        <ChevronRightIcon size={18} />
      </button>
    </div>
  );
}

interface WeekChipsProps {
  week: WeekSummary;
  chip: ReviewChip;
  onChange: (chip: ReviewChip) => void;
}

function sameChip(a: ReviewChip, b: ReviewChip): boolean {
  return a?.kind === b?.kind && a?.value === b?.value;
}

function Chip({ active, onClick, className, children }: { active: boolean; onClick: () => void; className: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-shadow ${className} ${active ? "ring-2 ring-[var(--color-notebook-accent)]" : ""}`}
    >
      {children}
    </button>
  );
}

/** Counts for the week; picking one narrows the list to it, picking it again shows everything. */
function WeekChips({ week, chip, onChange }: WeekChipsProps) {
  const toggle = (next: ReviewChip) => onChange(sameChip(chip, next) ? null : next);

  return (
    <div className="flex flex-wrap gap-2 px-1 mb-6">
      <Chip
        active={chip === null}
        onClick={() => onChange(null)}
        className="bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] text-[var(--color-notebook-text)]"
      >
        <span className="font-semibold">{week.entryCount}</span> {week.entryCount === 1 ? "note" : "notes"}
      </Chip>
      {week.signifierCounts.map(([signifier, count]) => {
        const cfg = SIGNIFIER_CONFIG[signifier];
        return (
          <Chip
            key={signifier}
            active={sameChip(chip, { kind: "signifier", value: signifier })}
            onClick={() => toggle({ kind: "signifier", value: signifier })}
            className={`${cfg.chip} ${cfg.color}`}
          >
            <span className="font-semibold">{count}</span> {cfg.label}
          </Chip>
        );
      })}
      {week.tagCounts.slice(0, MAX_TAG_CHIPS).map(([tag, count]) => (
        <Chip
          key={tag}
          active={sameChip(chip, { kind: "tag", value: tag })}
          onClick={() => toggle({ kind: "tag", value: tag })}
          className={getTagColor(tag)}
        >
          <span className="font-semibold">{count}</span> {tag}
        </Chip>
      ))}
    </div>
  );
}

function ReviewEntryRow({ entry, onClick }: { entry: WorkLedgerEntry; onClick?: (entryId: string) => void }) {
  const sig = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;
  const hasMeta = !!sig || entry.tags?.length > 0;

  return (
    <button
      onClick={() => onClick?.(entry.id)}
      className="w-full text-left px-1 py-3 hover:bg-[var(--color-notebook-surface-alt)] active:bg-[var(--color-notebook-surface-alt)] transition-colors"
    >
      <span className="flex items-baseline gap-3">
        <span className="flex-1 min-w-0 truncate font-display text-[15px] font-medium text-[var(--color-notebook-text)]">{extractTitle(entry)}</span>
        <span className="shrink-0 font-mono text-xs text-[var(--color-notebook-muted)]">{formatTime(entry.createdAt)}</span>
      </span>
      {hasMeta && (
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          {sig && <span className={`font-semibold uppercase tracking-wide ${sig.color}`}>{sig.label}</span>}
          {entry.tags?.map((tag) => (
            <span key={tag} className={`px-1.5 py-px rounded-full ${getTagColor(tag)}`}>{tag}</span>
          ))}
        </span>
      )}
    </button>
  );
}
