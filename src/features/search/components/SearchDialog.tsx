import { SearchPanel } from "./SearchPanel.tsx";
import { useSearch } from "../hooks/useSearch.ts";

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onResultClick: (entryId: string, dayKey: string) => void;
}

/**
 * Owns the query and results so each keystroke re-renders only the dialog, not
 * the app around it. State lives in the open dialog: closing unmounts it, which
 * clears the query and drops any search still in flight.
 */
export function SearchDialog({ isOpen, onClose, onResultClick }: SearchDialogProps) {
  if (!isOpen) return null;
  return <OpenSearchDialog onClose={onClose} onResultClick={onResultClick} />;
}

function OpenSearchDialog({ onClose, onResultClick }: Omit<SearchDialogProps, "isOpen">) {
  const { query, results, search } = useSearch();
  return (
    <SearchPanel
      isOpen
      query={query}
      results={results}
      onSearch={search}
      onClose={onClose}
      onResultClick={onResultClick}
    />
  );
}
