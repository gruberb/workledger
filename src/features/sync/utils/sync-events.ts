type EntryEventDetail = { entryId: string };

export function onEntryChanged(handler: (entryId: string) => void): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<EntryEventDetail>).detail;
    handler(detail.entryId);
  };
  window.addEventListener("workledger:entry-changed", listener);
  return () => window.removeEventListener("workledger:entry-changed", listener);
}

export function onEntryDeleted(handler: (entryId: string) => void): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<EntryEventDetail>).detail;
    handler(detail.entryId);
  };
  window.addEventListener("workledger:entry-deleted", listener);
  return () => window.removeEventListener("workledger:entry-deleted", listener);
}
