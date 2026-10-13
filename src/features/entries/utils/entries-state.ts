import type { EntrySignifier, WorkLedgerEntry } from "../types/entry.ts";

/** Entries grouped by dayKey, newest first within each day. */
export type EntriesByDay = Map<string, WorkLedgerEntry[]>;

export interface ActiveSnapshot {
  entriesByDay: EntriesByDay;
  /** Every day with at least one non-archived entry, newest first. */
  dayKeys: string[];
  archivedCount: number;
  /** Tags and signifiers on any non-archived entry, loaded or not, for the sidebar filters. */
  allTags: string[];
  allSignifiers: EntrySignifier[];
  /** Only built when `withArchive` is set. */
  archivedEntriesByDay?: EntriesByDay;
}

export interface SnapshotOptions {
  /** Number of most recent days to load. */
  recentDays: number;
  /** Days loaded on demand (navigation, day clicks) that must survive a refresh. */
  extraDays?: ReadonlySet<string>;
  /** Load every non-archived entry, e.g. while filters are active. */
  all?: boolean;
  /** Also group archived entries (the archive view is open or was opened). */
  withArchive?: boolean;
}

/**
 * Picks which non-archived entries to keep in memory.
 *
 * Days are always loaded whole so local updates can tell when a day becomes
 * empty. Days holding a pinned entry are included so the Pinned section is
 * complete even for entries older than the recent window.
 */
export function buildActiveSnapshot(entries: WorkLedgerEntry[], options: SnapshotOptions): ActiveSnapshot {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt);
  const active = sorted.filter((e) => !e.isArchived);
  const archived = sorted.filter((e) => e.isArchived);

  const allDays = new Set<string>();
  const allTags = new Set<string>();
  const allSignifiers = new Set<EntrySignifier>();
  const included = new Set<string>(options.extraDays);
  for (const entry of active) {
    allDays.add(entry.dayKey);
    for (const tag of entry.tags) allTags.add(tag);
    if (entry.signifier) allSignifiers.add(entry.signifier);
    if (options.all || entry.isPinned) included.add(entry.dayKey);
  }
  const dayKeys = [...allDays].sort((a, b) => b.localeCompare(a));
  for (const dayKey of dayKeys.slice(0, options.recentDays)) included.add(dayKey);

  const entriesByDay: EntriesByDay = new Map();
  for (const dayKey of dayKeys) {
    if (included.has(dayKey)) entriesByDay.set(dayKey, []);
  }
  for (const entry of active) {
    entriesByDay.get(entry.dayKey)?.push(entry);
  }

  let archivedEntriesByDay: EntriesByDay | undefined;
  if (options.withArchive) {
    archivedEntriesByDay = new Map();
    for (const entry of archived) {
      const day = archivedEntriesByDay.get(entry.dayKey);
      if (day) day.push(entry);
      else archivedEntriesByDay.set(entry.dayKey, [entry]);
    }
  }
  return {
    entriesByDay,
    dayKeys,
    archivedCount: archived.length,
    allTags: [...allTags],
    allSignifiers: [...allSignifiers],
    archivedEntriesByDay,
  };
}

/** Returns `prev` when both lists hold the same items in the same order, so React skips the update. */
export function keepIfSame<T>(prev: T[], next: T[]): T[] {
  return prev.length === next.length && prev.every((item, i) => item === next[i]) ? prev : next;
}

/**
 * Keeps the previous entry objects (and day arrays, and the map itself) when a
 * reload read the same versions back. Every content or metadata write bumps
 * `updatedAt`, so an equal timestamp means equal content. Without this, a
 * reload gives every entry a new `blocks` reference, and each mounted editor
 * then serializes its whole document to find out nothing changed.
 */
export function reuseUnchanged(prev: EntriesByDay, next: EntriesByDay): EntriesByDay {
  const prevById = new Map<string, WorkLedgerEntry>();
  for (const entries of prev.values()) for (const e of entries) prevById.set(e.id, e);

  let allSame = prev.size === next.size;
  const merged: EntriesByDay = new Map();
  for (const [dayKey, entries] of next) {
    const reused = entries.map((e) => {
      const old = prevById.get(e.id);
      return old && old.updatedAt === e.updatedAt ? old : e;
    });
    const before = prev.get(dayKey);
    const sameDay = !!before && before.length === reused.length && before.every((e, i) => e === reused[i]);
    if (!sameDay) allSame = false;
    merged.set(dayKey, sameDay ? before : reused);
  }
  return allSame ? prev : merged;
}

export function findEntry(map: EntriesByDay, id: string): WorkLedgerEntry | undefined {
  for (const entries of map.values()) {
    const found = entries.find((e) => e.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Applies `update` to the entry with `id`. Returns the same map when the entry
 * is not loaded, so React skips the re-render.
 */
export function updateInMap(
  map: EntriesByDay,
  id: string,
  update: (entry: WorkLedgerEntry) => WorkLedgerEntry,
): EntriesByDay {
  for (const [dayKey, entries] of map) {
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) continue;
    const next = new Map(map);
    const dayEntries = [...entries];
    dayEntries[idx] = update(entries[idx]);
    next.set(dayKey, dayEntries);
    return next;
  }
  return map;
}

/** Inserts or replaces an entry, keeping its day sorted newest first. */
export function upsertInMap(map: EntriesByDay, entry: WorkLedgerEntry): EntriesByDay {
  const next = new Map(map);
  const dayEntries = (next.get(entry.dayKey) ?? []).filter((e) => e.id !== entry.id);
  const insertAt = dayEntries.findIndex((e) => e.createdAt < entry.createdAt);
  dayEntries.splice(insertAt < 0 ? dayEntries.length : insertAt, 0, entry);
  next.set(entry.dayKey, dayEntries);
  return next;
}

/** Removes an entry; drops its day when it becomes empty. */
export function removeFromMap(map: EntriesByDay, id: string): EntriesByDay {
  for (const [dayKey, entries] of map) {
    if (!entries.some((e) => e.id === id)) continue;
    const next = new Map(map);
    const remaining = entries.filter((e) => e.id !== id);
    if (remaining.length > 0) next.set(dayKey, remaining);
    else next.delete(dayKey);
    return next;
  }
  return map;
}

export function setDayInMap(map: EntriesByDay, dayKey: string, entries: WorkLedgerEntry[]): EntriesByDay {
  const next = new Map(map);
  if (entries.length > 0) next.set(dayKey, entries);
  else next.delete(dayKey);
  return next;
}

export function addDayKey(dayKeys: string[], dayKey: string): string[] {
  if (dayKeys.includes(dayKey)) return dayKeys;
  return [...dayKeys, dayKey].sort((a, b) => b.localeCompare(a));
}
