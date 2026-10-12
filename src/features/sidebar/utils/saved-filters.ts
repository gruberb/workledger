import { SIGNIFIER_CONFIG, type EntrySignifier } from "../../entries/index.ts";
import type { FilterState, SavedFilter } from "../types/saved-filter.ts";

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function savedFilterMatches(filter: SavedFilter, current: FilterState): boolean {
  return (
    sameSet(filter.tags, current.tags) &&
    sameSet(filter.signifiers, current.signifiers)
  );
}

function isSignifier(value: unknown): value is EntrySignifier {
  return typeof value === "string" && value in SIGNIFIER_CONFIG;
}

/**
 * Parses stored saved filters. Filters saved before signifiers were part of
 * a filter have no `signifiers` field; they load as "no signifier filter".
 * Text filtering was removed (full-text search replaces it): a stored
 * `textQuery` is ignored, and a filter that was text only is dropped because
 * it would now match everything.
 */
export function normalizeSavedFilters(raw: unknown): SavedFilter[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null && typeof f.id === "string")
    .map((f) => ({
      id: f.id as string,
      name: typeof f.name === "string" ? f.name : "",
      tags: Array.isArray(f.tags) ? f.tags.filter((t): t is string => typeof t === "string") : [],
      signifiers: Array.isArray(f.signifiers) ? f.signifiers.filter(isSignifier) : [],
    }))
    .filter((f) => f.tags.length > 0 || f.signifiers.length > 0);
}
