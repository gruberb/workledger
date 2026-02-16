// Public API for the entries feature

// Context & hooks
export { EntriesProvider, useEntriesData, useEntriesActions } from "./context/EntriesContext.tsx";
export { useEntryNavigation } from "./hooks/useEntryNavigation.ts";
export { useAutoSave } from "./hooks/useAutoSave.ts";

// Components
export { EntryStream } from "./components/EntryStream.tsx";
export { EntryCard } from "./components/EntryCard.tsx";
export { NewEntryButton } from "./components/NewEntryButton.tsx";

// Types
export type { WorkLedgerEntry, SearchIndexEntry } from "./types/entry.ts";

// Storage operations (for cross-feature use)
export { getEntry, getAllEntries } from "./storage/entries.ts";
export { searchEntries, getRecentSearchEntries, extractTextFromBlocks, deleteSearchIndex, updateSearchIndex } from "./storage/search-index.ts";
export { exportAllEntries, importEntries } from "./storage/import-export.ts";

// Utils (entries-specific)
export { extractTitle } from "./utils/extract-title.ts";

// Validation
export { validateEntry, validateImportEnvelope } from "./utils/validation.ts";
