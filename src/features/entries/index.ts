// Public API for the entries feature
export { EntriesProvider, useEntriesData, useEntriesActions } from "./context/EntriesContext.tsx";
export { EntryStream } from "./components/EntryStream.tsx";
export { EntryCard } from "./components/EntryCard.tsx";
export { NewEntryButton } from "./components/NewEntryButton.tsx";
export { useEntryNavigation } from "./hooks/useEntryNavigation.ts";
export type { WorkLedgerEntry, SearchIndexEntry } from "./types/entry.ts";
