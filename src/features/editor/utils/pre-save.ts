/**
 * Blocks that debounce their own state (Excalidraw strokes) register here so
 * it lands in the editor document before the entry's final save reads it.
 * Needed because the entry's unmount flush runs before its blocks' cleanups,
 * and nothing else flushes block debounces on page hide.
 */
const hooks = new WeakMap<object, Set<() => boolean>>();

/** `flush` returns true when it wrote something into the document. Returns an unregister function. */
export function registerPreSave(editor: object, flush: () => boolean): () => void {
  let set = hooks.get(editor);
  if (!set) {
    set = new Set();
    hooks.set(editor, set);
  }
  set.add(flush);
  return () => {
    set.delete(flush);
  };
}

/** Runs every registered flush for this editor. True when any of them changed the document. */
export function runPreSave(editor: object): boolean {
  let changed = false;
  for (const flush of hooks.get(editor) ?? []) {
    if (flush()) changed = true;
  }
  return changed;
}
