import type { PartialBlock } from "@blocknote/core";

export interface WorkLedgerEntry {
  id: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
  blocks: PartialBlock[];
  isArchived: boolean;
  tags: string[];
  isPinned?: boolean;
  signifier?: EntrySignifier;
}

export type EntrySignifier = "note" | "decision" | "task" | "question" | "idea";

export const SIGNIFIER_CONFIG: Record<EntrySignifier, { label: string; color: string; icon: string }> = {
  note: { label: "Note", color: "text-blue-500", icon: "N" },
  decision: { label: "Decision", color: "text-emerald-500", icon: "D" },
  task: { label: "Task", color: "text-violet-500", icon: "T" },
  question: { label: "Question", color: "text-amber-500", icon: "?" },
  idea: { label: "Idea", color: "text-pink-500", icon: "!" },
};

export interface SearchIndexEntry {
  entryId: string;
  dayKey: string;
  plainText: string;
  updatedAt: number;
  tags: string[];
}

export interface WorkLedgerSettings {
  key: string;
  value: string;
}
