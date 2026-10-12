// Public API for the entries feature

// Context & hooks
export { EntriesProvider, useEntriesData, useEntriesActions } from "./context/EntriesContext.tsx";
export { useAutoSave } from "./hooks/useAutoSave.ts";

// Components
export { EntryStream } from "./components/EntryStream.tsx";
export { ReviewStream } from "./components/ReviewStream.tsx";
export { NewEntryButton } from "./components/NewEntryButton.tsx";
export { NewEntryIconButton } from "./components/NewEntryIconButton.tsx";

// Types
export type {
  WorkLedgerEntry,
  SearchIndexEntry,
  EntrySignifier,
  EntryActions,
  EntryEditorProps,
  EntryEditorComponent,
} from "./types/entry.ts";
export { SIGNIFIER_CONFIG } from "./types/entry.ts";

// Storage operations (for cross-feature use)
export { getEntry, getAllEntries, getAllEntryIds } from "./storage/entries.ts";
export { searchEntries, getRecentSearchEntries, extractTextFromBlocks } from "./storage/search-index.ts";
export { exportAllEntries, importEntries, saveImportedEntries } from "./storage/import-export.ts";
export { applyRemoteEntries, type RemoteEntry } from "./storage/remote-entries.ts";

// Utils (entries-specific)
export { extractTitle } from "./utils/extract-title.ts";
export type { EntryTemplate } from "./utils/templates.ts";

