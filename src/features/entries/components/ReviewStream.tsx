import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { SIGNIFIER_CONFIG, type EntrySignifier } from "../types/entry.ts";
import { formatDayKey } from "../../../utils/dates.ts";
import { extractTitle } from "../utils/extract-title.ts";
import { extractPreview } from "../utils/extract-title.ts";

interface ReviewStreamProps {
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  onEntryClick?: (entryId: string) => void;
  onOpenAI?: () => void;
}

interface DayGroup {
  dayKey: string;
  dayLabel: string;
  entries: WorkLedgerEntry[];
}

interface WeekGroup {
  weekKey: string;
  weekLabel: string;
  dateRange: string;
  days: DayGroup[];
  entryCount: number;
  topTags: [string, number][];
  signifierCounts: [EntrySignifier, number][];
}

function getISOWeekKey(dayKey: string): string {
  const date = new Date(dayKey + "T00:00:00");
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function getMondayOfISOWeek(weekKey: string): Date {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

function getCurrentISOWeekKey(): string {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return getISOWeekKey(dayKey);
}

function getPreviousWeekKey(weekKey: string): string {
  const monday = getMondayOfISOWeek(weekKey);
  monday.setUTCDate(monday.getUTCDate() - 7);
  const dayKey = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
  return getISOWeekKey(dayKey);
}

function formatWeekLabel(weekKey: string): string {
  const currentWeek = getCurrentISOWeekKey();
  if (weekKey === currentWeek) return "This Week";
  const lastWeek = getPreviousWeekKey(currentWeek);
  if (weekKey === lastWeek) return "Last Week";
  const monday = getMondayOfISOWeek(weekKey);
  return `Week of ${format(monday, "MMM d")}`;
}

function getWeekDateRange(dayKeys: string[]): string {
  const sorted = [...dayKeys].sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return formatDayKey(sorted[0]);
  return `${formatDayKey(sorted[0])} — ${formatDayKey(sorted[sorted.length - 1])}`;
}

function formatShortDay(dayKey: string): string {
  const date = new Date(dayKey + "T00:00:00");
  return format(date, "EEEE, MMM d");
}

export function ReviewStream({ entriesByDay, onEntryClick, onOpenAI }: ReviewStreamProps) {
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const weekMap = new Map<string, Map<string, WorkLedgerEntry[]>>();

    for (const [dayKey, entries] of entriesByDay) {
      const weekKey = getISOWeekKey(dayKey);
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
      weekMap.get(weekKey)!.set(dayKey, entries);
    }

    return [...weekMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekKey, dayMap]) => {
        const tagCounts = new Map<string, number>();
        const sigCounts = new Map<EntrySignifier, number>();
        let entryCount = 0;

        const days: DayGroup[] = [...dayMap.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([dayKey, entries]) => {
            entryCount += entries.length;
            for (const entry of entries) {
              for (const tag of entry.tags ?? []) {
                tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
              }
              if (entry.signifier) {
                sigCounts.set(entry.signifier, (sigCounts.get(entry.signifier) ?? 0) + 1);
              }
            }
            return {
              dayKey,
              dayLabel: formatShortDay(dayKey),
              entries: entries.sort((a, b) => b.createdAt - a.createdAt),
            };
          });

        const topTags = [...tagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);
        const signifierCounts = [...sigCounts.entries()]
          .sort((a, b) => b[1] - a[1]);

        return {
          weekKey,
          weekLabel: formatWeekLabel(weekKey),
          dateRange: getWeekDateRange([...dayMap.keys()]),
          days,
          entryCount,
          topTags,
          signifierCounts,
        };
      });
  }, [entriesByDay]);

  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
    if (weekGroups.length === 0) return new Set<string>();
    return new Set([weekGroups[0].weekKey]);
  });

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) {
        next.delete(weekKey);
      } else {
        next.add(weekKey);
      }
      return next;
    });
  };

  if (weekGroups.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-24">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600 mb-4">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <p className="text-gray-400 dark:text-gray-500">No entries to review</p>
      </div>
    );
  }

  return (
    <div className="entry-stream">
      {/* Sticky header */}
      <div className="flex items-center gap-3 pt-8 pb-4 px-1 sticky top-0 sticky-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-notebook-muted)]">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="text-lg font-semibold text-[var(--color-notebook-text)]">Weekly Review</span>
      </div>

      <div className="space-y-10 pb-16">
        {weekGroups.map((week) => {
          const isExpanded = expandedWeeks.has(week.weekKey);

          return (
            <div key={week.weekKey}>
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.weekKey)}
                className="w-full text-left group"
              >
                <div className="flex items-baseline gap-3 px-1">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-gray-300 dark:text-gray-600 shrink-0 relative top-[1px] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <h2 className="text-xl font-bold text-[var(--color-notebook-text)] group-hover:text-[var(--color-notebook-text)]/80 transition-colors">
                    {week.weekLabel}
                  </h2>
                  <span className="text-sm text-[var(--color-notebook-muted)]">
                    {week.entryCount} {week.entryCount === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-notebook-muted)] mt-1 px-1">{week.dateRange}</p>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mt-4">
                  {/* Week summary cards */}
                  {(week.signifierCounts.length > 0 || week.topTags.length > 0) && (
                    <div className="flex flex-wrap gap-2.5 mb-6 px-1">
                      {week.signifierCounts.map(([sig, count]) => {
                        const cfg = SIGNIFIER_CONFIG[sig];
                        const bgColor = { note: "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40", decision: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40", task: "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/40", question: "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40", idea: "bg-pink-50 dark:bg-pink-950/30 border-pink-100 dark:border-pink-900/40" }[sig];
                        return (
                          <div key={sig} className={`rounded-lg border px-3.5 py-2 flex flex-col items-center justify-center shadow-sm ${bgColor}`}>
                            <div className={`text-base font-bold leading-none ${cfg.color}`}>{count}</div>
                            <div className={`text-[10px] font-medium mt-1 ${cfg.color} opacity-70`}>{cfg.label}{count !== 1 ? "s" : ""}</div>
                          </div>
                        );
                      })}
                      {week.topTags.slice(0, 4).map(([tag, count]) => (
                        <div key={tag} className="rounded-lg border border-gray-150 dark:border-gray-700/60 bg-white/60 dark:bg-gray-800/30 px-3.5 py-2 flex flex-col items-center justify-center shadow-sm">
                          <div className="text-base font-bold leading-none text-[var(--color-notebook-text)]">{count}</div>
                          <div className="text-[10px] font-medium mt-1 text-[var(--color-notebook-muted)]">{tag}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Entries grouped by day */}
                  <div className="space-y-6">
                    {week.days.map((day) => (
                      <div key={day.dayKey}>
                        {/* Day sub-header — sticky beneath main header */}
                        <div className="flex items-center gap-3 mb-3 px-1 py-2 sticky top-[45px] z-[9] bg-[var(--color-notebook-bg)]">
                          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-notebook-muted)] shrink-0">
                            {day.dayLabel}
                          </h3>
                          <div className="flex-1 h-px bg-gray-200/60 dark:bg-gray-700/60" />
                        </div>

                        {/* Entries for this day */}
                        <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
                          {day.entries.map((entry) => {
                            const preview = extractPreview(entry);
                            const isPinned = !!entry.isPinned;
                            const sig = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : null;
                            const borderColor = sig
                              ? { note: "border-blue-400", decision: "border-emerald-400", task: "border-violet-400", question: "border-amber-400", idea: "border-pink-400" }[entry.signifier!]
                              : "border-transparent";

                            return (
                              <button
                                key={entry.id}
                                onClick={() => onEntryClick?.(entry.id)}
                                className={`w-full text-left px-4 py-3.5 transition-colors group cursor-pointer hover:bg-[var(--color-notebook-surface-alt)] border-l-2 ${borderColor}`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {sig && (
                                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${sig.color}`}>
                                      {sig.label}
                                    </span>
                                  )}
                                  {entry.tags && entry.tags.length > 0 && (
                                    <div className="flex gap-1.5">
                                      {sig && <span className="text-gray-200 dark:text-gray-700">/</span>}
                                      {entry.tags.slice(0, 3).map((tag) => (
                                        <span key={tag} className="text-[11px] text-[var(--color-notebook-muted)]">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <h4 className={`text-[15px] leading-snug ${isPinned ? "font-semibold text-[var(--color-notebook-text)]" : "font-medium text-[var(--color-notebook-text)] group-hover:text-[var(--color-notebook-text)]"} transition-colors`}>
                                  {extractTitle(entry)}
                                </h4>
                                {preview && (
                                  <p className="text-sm text-[var(--color-notebook-muted)] leading-relaxed mt-1 line-clamp-2">
                                    {preview}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI summarize */}
                  {onOpenAI && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAI();
                      }}
                      className="mt-5 px-1 inline-flex items-center gap-1.5 text-xs text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a6 6 0 0 1 6 6c0 3-2 5-3 6.5S13 17 13 19h-2c0-2-1-3-2-4.5S6 11 6 8a6 6 0 0 1 6-6z" />
                        <line x1="10" y1="22" x2="14" y2="22" />
                      </svg>
                      Summarize with AI
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
