import { useEffect, useMemo, useState } from "react";
import type { WorkLedgerEntry } from "../types/entry.ts";
import { getAllEntries } from "../storage/entries.ts";
import { collectOpenLoops, type OpenLoopBucket, type OpenLoopFilter } from "../utils/open-loops.ts";
import { useTodayKey } from "../../../hooks/useTodayKey.ts";
import { on } from "../../../utils/events.ts";

/** Coalesces a burst of change events (a sync page, an import) into one read. */
const RELOAD_DEBOUNCE_MS = 300;

/**
 * Open items live in every note, not only the recent days kept in memory, so
 * this reads all entries while the view is open and again after any change.
 * One getAll is a few tens of ms for thousands of entries; the result is not
 * kept in the entries state, so the journal's memory stays unchanged.
 *
 * Returns null until the first read finishes.
 */
export function useOpenLoops(filter: OpenLoopFilter): OpenLoopBucket[] | null {
  const today = useTodayKey();
  const [entries, setEntries] = useState<WorkLedgerEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      getAllEntries()
        .then((all) => { if (!cancelled) setEntries(all); })
        .catch((err) => console.error("[open-loops] could not read entries", err));
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(load, RELOAD_DEBOUNCE_MS);
    };
    load();
    const offChanged = on("entry-changed", schedule);
    const offDeleted = on("entry-deleted", schedule);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      offChanged();
      offDeleted();
    };
  }, []);

  const { tags, signifiers } = filter;
  return useMemo(
    () => (entries ? collectOpenLoops(entries, today, { tags, signifiers }) : null),
    [entries, today, tags, signifiers],
  );
}
