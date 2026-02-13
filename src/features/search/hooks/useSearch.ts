import { useState, useCallback, useRef } from "react";
import type { SearchIndexEntry } from "../../entries/types/entry.ts";
import { searchEntries } from "../../entries/storage/search-index.ts";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchIndexEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const found = await searchEntries(q);
      setResults(found);
    }, 200);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  return { query, results, isOpen, search, open, close };
}
