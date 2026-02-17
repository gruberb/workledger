import { useCallback } from "react";
import { getAllEntries, extractTextFromBlocks } from "../../entries/index.ts";
import type { WorkLedgerEntry } from "../../entries/index.ts";
import type { Block } from "@blocknote/core";
import { todayKey } from "../../../utils/dates.ts";
import type { ActionScope } from "../actions/types.ts";

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function entryToText(entry: WorkLedgerEntry): string {
  const text = extractTextFromBlocks(entry.blocks as Block[]);
  const tags = entry.tags.length > 0 ? ` [${entry.tags.join(", ")}]` : "";
  return `--- ${entry.dayKey}${tags} ---\n${text}`;
}

export function useMultiEntryContext() {
  const gatherContext = useCallback(async (
    scope: ActionScope,
    targetEntry: WorkLedgerEntry | null,
    topicQuery?: string,
  ): Promise<string> => {
    if (scope === "entry") {
      if (!targetEntry) return "";
      return entryToText(targetEntry);
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
      const weekStart = getWeekStart();
      const weekEntries = active
        .filter((e) => e.dayKey >= weekStart)
        .sort((a, b) => a.createdAt - b.createdAt);
      if (weekEntries.length === 0) return "(No entries this week)";
      return weekEntries.map(entryToText).join("\n\n");
    }

    if (scope === "topic" && topicQuery) {
      const query = topicQuery.toLowerCase();
      const matching = active.filter((e) => {
        const text = extractTextFromBlocks(e.blocks as Block[]).toLowerCase();
        const tagMatch = e.tags.some((t) => t.toLowerCase().includes(query));
        return text.includes(query) || tagMatch;
      }).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
      if (matching.length === 0) return `(No entries found about "${topicQuery}")`;
      return matching.map(entryToText).join("\n\n");
    }

    return "";
  }, []);

  return { gatherContext };
}
