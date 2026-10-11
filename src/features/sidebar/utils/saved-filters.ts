import { SIGNIFIER_CONFIG, type EntrySignifier } from "../../entries/index.ts";
import type { FilterState, SavedFilter } from "../types/saved-filter.ts";

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function savedFilterMatches(filter: SavedFilter, current: FilterState): boolean {
  return (
    filter.textQuery === current.textQuery &&
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
 */
export function normalizeSavedFilters(raw: unknown): SavedFilter[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null && typeof f.id === "string")
    .map((f) => ({
      id: f.id as string,
      name: typeof f.name === "string" ? f.name : "",
      tags: Array.isArray(f.tags) ? f.tags.filter((t): t is string => typeof t === "string") : [],
      textQuery: typeof f.textQuery === "string" ? f.textQuery : "",
      signifiers: Array.isArray(f.signifiers) ? f.signifiers.filter(isSignifier) : [],
    }));
}
