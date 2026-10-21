import { useCallback } from "react";
import { getAllEntries, getEntries, extractTextFromBlocks } from "../../entries/index.ts";
import type { WorkLedgerEntry } from "../../entries/index.ts";
import type { Block } from "@blocknote/core";
import { todayKey } from "../../../utils/dates.ts";
import { weekStartDayKey } from "../../../utils/weeks.ts";
import type { ActionScope } from "../actions/types.ts";

function entryToText(entry: WorkLedgerEntry): string {
  const text = extractTextFromBlocks(entry.blocks as Block[]);
  const tags = entry.tags.length > 0 ? ` [${entry.tags.join(", ")}]` : "";
  return `--- ${entry.dayKey}${tags} ---\n${text}`;
}

/** Reads the stored versions, so edits made since the notes were attached are included. */
async function notesText(entryIds: string[]): Promise<string> {
  if (entryIds.length === 0) return "";
  const entries = await getEntries(entryIds);
  return entries.map(entryToText).join("\n\n");
}

export function useMultiEntryContext() {
  const gatherContext = useCallback(async (
    scope: ActionScope,
    entryIds: string[],
    query?: string,
  ): Promise<string> => {
    if (scope === "entry") return notesText(entryIds);

    if (scope === "ask") {
      const question = query ?? "";
      const notes = await notesText(entryIds);
      if (!notes) return question;
      const label = entryIds.length === 1 ? "Context from my notebook entry" : "Context from my notebook entries";
      return `${question}\n\n${label}:\n\n${notes}`;
    }

    const allEntries = await getAllEntries();
    const active = allEntries.filter((e) => !e.isArchived);

    if (scope === "day") {
      const today = todayKey();
      const todayEntries = active
        .filter((e) => e.dayKey === today)
        .sort((a, b) => a.createdAt - b.createdAt);
      if (todayEntries.length === 0) return "(No entries today)";
      return todayEntries.map(entryToText).join("\n\n");
    }

    if (scope === "week") {
      const weekStart = weekStartDayKey(new Date());
      const weekEntries = active
        .filter((e) => e.dayKey >= weekStart)
        .sort((a, b) => a.createdAt - b.createdAt);
      if (weekEntries.length === 0) return "(No entries this week)";
      return weekEntries.map(entryToText).join("\n\n");
    }

    if (scope === "topic" && query) {
      const needle = query.toLowerCase();
      const matching = active.filter((e) => {
        const text = extractTextFromBlocks(e.blocks as Block[]).toLowerCase();
        const tagMatch = e.tags.some((t) => t.toLowerCase().includes(needle));
        return text.includes(needle) || tagMatch;
      }).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
      if (matching.length === 0) return `(No entries found about "${query}")`;
      return matching.map(entryToText).join("\n\n");
    }

    return "";
  }, []);

  return { gatherContext };
}
