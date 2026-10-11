/**
 * Typed event bus for cross-feature communication.
 * Replaces untyped window.dispatchEvent(CustomEvent) calls.
 */

interface AppEvents {
  "entry-changed": { entryId: string };
  "entry-deleted": { entryId: string };
  "navigate-entry": { entryId: string };
  /** Another tab holds an older DB version open, so the upgrade cannot start. */
  "db-blocked": Record<string, never>;
  /** A newer app version opened the DB in another tab; this tab's connection was closed. */
  "db-outdated": Record<string, never>;
}

type EventHandler<T> = (detail: T) => void;

const listeners = new Map<string, Set<EventHandler<unknown>>>();

export function emit<K extends keyof AppEvents>(event: K, detail: AppEvents[K]): void {
  const handlers = listeners.get(event);
  if (handlers) {
    for (const handler of handlers) {
      handler(detail);
    }
  }
}

export function on<K extends keyof AppEvents>(event: K, handler: EventHandler<AppEvents[K]>): () => void {
  let handlers = listeners.get(event);
  if (!handlers) {
    handlers = new Set();
    listeners.set(event, handlers);
  }
  handlers.add(handler as EventHandler<unknown>);
  return () => {
    handlers!.delete(handler as EventHandler<unknown>);
  };
}
