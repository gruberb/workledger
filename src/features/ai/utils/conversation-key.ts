import type { ActionScope } from "../actions/types.ts";
import { isoWeekKey, toDayKey } from "../../../utils/weeks.ts";

/**
 * Storage key that decides when a saved conversation is resumed. Day and
 * week scopes include the current period, so "My Day" tomorrow starts fresh
 * instead of resuming today's summary.
 */
export function conversationKey(
  scope: ActionScope,
  context: { entryIds?: string[]; query?: string; now?: Date },
): string {
  const now = context.now ?? new Date();
  switch (scope) {
    case "entry":
      // One note keys by its id alone, as threads saved before multi-note context did.
      return context.entryIds?.length ? [...context.entryIds].sort().join("+") : "global";
    case "day":
      return `day-${toDayKey(now)}`;
    case "week":
      return `week-${isoWeekKey(toDayKey(now))}`;
    case "topic":
      return `topic-${(context.query ?? "").trim().toLowerCase()}`;
    case "ask":
      // Every question is its own conversation; asking again must not resume an old answer.
      return `ask-${now.getTime()}`;
  }
}
