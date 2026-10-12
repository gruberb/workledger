import type { ComponentType } from "react";
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

export const SIGNIFIERS = ["decision", "question", "idea", "milestone", "rfd"] as const;

export type EntrySignifier = (typeof SIGNIFIERS)[number];

export function isEntrySignifier(value: unknown): value is EntrySignifier {
  return typeof value === "string" && (SIGNIFIERS as readonly string[]).includes(value);
}

interface SignifierStyle {
  label: string;
  /** Text color */
  color: string;
  /** Filter chip background */
  chip: string;
  /** Summary card background + border */
  card: string;
  /** Left accent border in list rows */
  accent: string;
}

// Full class strings (not interpolated) so Tailwind's scanner picks them up.
export const SIGNIFIER_CONFIG: Record<EntrySignifier, SignifierStyle> = {
  decision: {
    label: "Decision",
    color: "text-emerald-500",
    chip: "bg-emerald-100 dark:bg-emerald-950/40",
    card: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40",
    accent: "border-emerald-400",
  },
  question: {
    label: "Question",
    color: "text-amber-500",
    chip: "bg-amber-100 dark:bg-amber-950/40",
    card: "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40",
    accent: "border-amber-400",
  },
  idea: {
    label: "Idea",
    color: "text-pink-500",
    chip: "bg-pink-100 dark:bg-pink-950/40",
    card: "bg-pink-50 dark:bg-pink-950/30 border-pink-100 dark:border-pink-900/40",
    accent: "border-pink-400",
  },
  milestone: {
    label: "Milestone",
    color: "text-blue-500",
    chip: "bg-blue-100 dark:bg-blue-950/40",
    card: "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40",
    accent: "border-blue-400",
  },
  rfd: {
    label: "RFD",
    color: "text-violet-500",
    chip: "bg-violet-100 dark:bg-violet-950/40",
    card: "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/40",
    accent: "border-violet-400",
  },
};

export interface SearchIndexEntry {
  entryId: string;
  dayKey: string;
  plainText: string;
  updatedAt: number;
  tags: string[];
}

export interface NewEntryOptions {
  blocks?: PartialBlock[];
  tags?: string[];
  signifier?: EntrySignifier;
}

/** Per-entry callbacks. Omit one to hide its control (e.g. archive view has no pin). */
export interface EntryActions {
  onSave: (entryId: string, blocks: PartialBlock[]) => Promise<void>;
  onTagsChange?: (entryId: string, tags: string[]) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onSignifierChange?: (id: string, signifier: EntrySignifier | undefined) => void;
  onOpenAI?: (entry: WorkLedgerEntry) => void;
  onFocus?: (entry: WorkLedgerEntry) => void;
}

export interface EntryEditorProps {
  entry: WorkLedgerEntry;
  editable?: boolean;
  onSave: EntryActions["onSave"];
  autoFocus?: boolean;
}

/**
 * The editor is injected by the app so the core entries feature does not
 * depend on the editor feature (which itself depends on entries).
 */
export type EntryEditorComponent = ComponentType<EntryEditorProps>;
