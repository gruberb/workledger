import type { AIAction } from "../actions/types.ts";
import { CHAT_ACTION } from "../actions/actions.ts";
import { isoWeekKey, toDayKey } from "../../../utils/weeks.ts";

const MAX_LENGTH = 60;

function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > MAX_LENGTH ? `${flat.slice(0, MAX_LENGTH - 1)}…` : flat;
}

/** Label for the recent threads list, fixed when the thread starts. */
export function makeThreadTitle(
  action: AIAction,
  context: { query?: string; entryTitle?: string; now?: Date },
): string {
  const now = context.now ?? new Date();
  const query = clip(context.query ?? "");
  switch (action.scope) {
    case "ask":
      if (action.id === CHAT_ACTION.id) return query || action.name;
      return query ? `${action.name}: ${query}` : action.name;
    case "entry":
      return context.entryTitle ? `${action.name}: ${clip(context.entryTitle)}` : action.name;
    case "day":
      return `${action.name}: ${toDayKey(now)}`;
    case "week":
      return `${action.name}: ${isoWeekKey(toDayKey(now))}`;
    case "topic":
      return query ? `${action.name}: ${query}` : action.name;
  }
}
