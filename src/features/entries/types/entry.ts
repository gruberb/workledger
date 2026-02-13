import type { PartialBlock } from "@blocknote/core";

export interface WorkLedgerEntry {
  id: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
  blocks: PartialBlock[];
  isArchived: boolean;
  tags: string[];
}

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
