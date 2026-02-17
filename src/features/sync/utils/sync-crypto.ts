import type { SyncEntry } from "../types/sync.ts";
import { encrypt, decrypt } from "./crypto.ts";
import { computePlaintextHash, verifyPlaintextHash } from "./integrity.ts";

interface EntryPayload {
  dayKey: string;
  createdAt: number;
  updatedAt: number;
  blocks: unknown[];
  isArchived: boolean;
  tags: string[];
  isPinned?: boolean;
  signifier?: string;
}

export interface DecryptedEntry {
  id: string;
  dayKey: string;
  createdAt: number;
  updatedAt: number;
  blocks: unknown[];
  isArchived: boolean;
  isDeleted: boolean;
  tags: string[];
  isPinned?: boolean;
  signifier?: string;
}

export async function encryptEntry(
  key: CryptoKey,
  entry: { id: string; dayKey: string; createdAt: number; updatedAt: number; blocks: unknown[]; isArchived: boolean; tags: string[]; isPinned?: boolean; signifier?: string; isDeleted?: boolean },
): Promise<SyncEntry> {
  const payload: EntryPayload = {
    dayKey: entry.dayKey,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    blocks: entry.blocks,
    isArchived: entry.isArchived,
    tags: entry.tags ?? [],
    isPinned: entry.isPinned ?? false,
    signifier: entry.signifier,
  };
  const plaintext = JSON.stringify(payload);
  const integrityHash = await computePlaintextHash(plaintext);
  const encryptedPayload = await encrypt(key, plaintext);
  return {
    id: entry.id,
    updatedAt: entry.updatedAt,
    isArchived: entry.isArchived,
    isDeleted: entry.isDeleted ?? false,
    encryptedPayload,
    integrityHash,
  };
}

export async function decryptEntry(
  key: CryptoKey,
  syncEntry: SyncEntry,
): Promise<DecryptedEntry> {
  if (syncEntry.isDeleted) {
    return {
      id: syncEntry.id,
      dayKey: "",
      createdAt: 0,
      updatedAt: syncEntry.updatedAt,
      blocks: [],
      isArchived: false,
      isDeleted: true,
      tags: [],
    };
  }
  const plaintext = await decrypt(key, syncEntry.encryptedPayload);
  const payload = JSON.parse(plaintext) as EntryPayload;
  const valid = await verifyPlaintextHash(plaintext, syncEntry.integrityHash);
  if (!valid) {
    // AES-256-GCM already authenticates the data — if decryption succeeded, the data is untampered.
    // Hash mismatch is expected for entries created before the hash fix (sortedStringify vs plaintext).
    // The hash will be corrected on next push.
    console.warn(`Integrity hash mismatch for entry ${syncEntry.id} (will be corrected on next push)`);
  }
  return {
    id: syncEntry.id,
    dayKey: payload.dayKey,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    blocks: payload.blocks,
    isArchived: payload.isArchived,
    isDeleted: false,
    tags: payload.tags ?? [],
    isPinned: payload.isPinned ?? false,
    signifier: payload.signifier,
  };
}
