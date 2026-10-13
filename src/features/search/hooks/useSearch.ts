import { useState, useCallback, useEffect, useRef } from "react";
import type { SearchIndexEntry } from "../../entries/index.ts";
import { searchEntries } from "../../entries/index.ts";

export function useSearch(debounceMs = 200) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchIndexEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped per query and on unmount; responses from older requests are dropped
  // so a slow search cannot overwrite newer results or land after close.
  const requestIdRef = useRef(0);

  const cancelPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    requestIdRef.current++;
  }, []);

  const search = useCallback((q: string) => {
    setQuery(q);
    cancelPending();
    const requestId = requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      const found = await searchEntries(q);
      if (requestId === requestIdRef.current) setResults(found);
    }, debounceMs);
  }, [cancelPending, debounceMs]);

  useEffect(() => cancelPending, [cancelPending]);

  return { query, results, search };
}
