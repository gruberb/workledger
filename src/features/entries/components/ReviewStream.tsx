import { useMemo, useState } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { SIGNIFIER_CONFIG } from "../types/entry.ts";
import { extractTitle, extractPreview } from "../utils/extract-title.ts";
import { groupByWeek, type WeekGroup } from "../utils/review-weeks.ts";
import { useTodayKey } from "../../../hooks/useTodayKey.ts";
import { CalendarIcon, ChevronRightIcon } from "../../../components/ui/Icons.tsx";

interface ReviewStreamProps {
  entriesByDay: Map<string, WorkLedgerEntry[]>;
  onEntryClick?: (entryId: string) => void;
  onOpenAI?: () => void;
}

export function ReviewStream({ entriesByDay, onEntryClick, onOpenAI }: ReviewStreamProps) {
  const today = useTodayKey();
  const weekGroups = useMemo(() => groupByWeek(entriesByDay, today), [entriesByDay, today]);

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
        <CalendarIcon size={48} strokeWidth={1} className="text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-400 dark:text-gray-500">No entries to review</p>
      </div>
    );
  }

  return (
    <div className="entry-stream">
      <div className="flex items-center gap-3 pt-8 pb-4 px-1 sticky top-0 sticky-header">
        <CalendarIcon size={20} className="text-[var(--color-notebook-muted)]" />
        <span className="text-lg font-semibold text-[var(--color-notebook-text)]">Weekly Review</span>
      </div>

      <div className="space-y-10 pb-16">
        {weekGroups.map((week) => (
          <WeekSection
            key={week.weekKey}
            week={week}
            isExpanded={expandedWeeks.has(week.weekKey)}
            onToggle={() => toggleWeek(week.weekKey)}
            onEntryClick={onEntryClick}
            onOpenAI={onOpenAI}
          />
        ))}
      </div>
    </div>
  );
}

interface WeekSectionProps {
  week: WeekGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onEntryClick?: (entryId: string) => void;
  onOpenAI?: () => void;
}

function WeekSection({ week, isExpanded, onToggle, onEntryClick, onOpenAI }: WeekSectionProps) {
  return (
    <div>
      <button onClick={onToggle} className="w-full text-left group">
        <div className="flex items-baseline gap-3 px-1">
          <ChevronRightIcon
            size={16}
            strokeWidth={2.5}
            className={`text-gray-300 dark:text-gray-600 shrink-0 relative top-[1px] transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />
          <h2 className="text-xl font-bold text-[var(--color-notebook-text)] group-hover:text-[var(--color-notebook-text)]/80 transition-colors">
            {week.weekLabel}
          </h2>
          <span className="text-sm text-[var(--color-notebook-muted)]">
            {week.entryCount} {week.entryCount === 1 ? "entry" : "entries"}
          </span>
        </div>
        <p className="text-sm text-[var(--color-notebook-muted)] mt-1 px-1">{week.dateRange}</p>
      </button>

      {isExpanded && (
        <div className="mt-4">
          {(week.signifierCounts.length > 0 || week.topTags.length > 0) && (
            <div className="flex flex-wrap gap-2.5 mb-6 px-1">
              {week.signifierCounts.map(([sig, count]) => {
                const cfg = SIGNIFIER_CONFIG[sig];
                if (!cfg) return null;
                return (
                  <div key={sig} className={`rounded-lg border px-3.5 py-2 flex flex-col items-center justify-center shadow-sm ${cfg.card}`}>
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

          <div className="space-y-6">
            {week.days.map((day) => (
              <div key={day.dayKey}>
                {/* Day sub-header, sticky beneath the main header */}
                <div className="flex items-center gap-3 mb-3 px-1 py-2 sticky top-[45px] z-[9] bg-[var(--color-notebook-bg)]">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-notebook-muted)] shrink-0">
                    {day.dayLabel}
                  </h3>
                  <div className="flex-1 h-px bg-gray-200/60 dark:bg-gray-700/60" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {day.entries.map((entry) => (
                    <ReviewEntryRow key={entry.id} entry={entry} onClick={onEntryClick} />
                  ))}
                </div>
              </div>
            ))}
          </div>

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
}

function ReviewEntryRow({ entry, onClick }: { entry: WorkLedgerEntry; onClick?: (entryId: string) => void }) {
  const preview = extractPreview(entry);
  const sig = entry.signifier ? SIGNIFIER_CONFIG[entry.signifier] : undefined;

  return (
    <button
      onClick={() => onClick?.(entry.id)}
      className={`w-full text-left px-4 py-3.5 transition-colors group cursor-pointer hover:bg-[var(--color-notebook-surface-alt)] border-l-2 ${sig ? sig.accent : "border-transparent"}`}
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
      <h4 className={`text-[15px] leading-snug ${entry.isPinned ? "font-semibold" : "font-medium"} text-[var(--color-notebook-text)] transition-colors`}>
        {extractTitle(entry)}
      </h4>
      {preview && (
        <p className="text-sm text-[var(--color-notebook-muted)] leading-relaxed mt-1 line-clamp-2">
          {preview}
        </p>
      )}
    </button>
  );
}
