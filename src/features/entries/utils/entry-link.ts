/** Copies the deep link (`#entry-<id>`) of an entry to the clipboard. */
export function copyEntryLink(entryId: string): Promise<void> {
  return navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#entry-${entryId}`);
}
