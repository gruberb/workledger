import type { SyncEntry } from "../types/sync.ts";
import type { RemoteEntry, WorkLedgerEntry } from "../../entries/index.ts";
import { encrypt, decrypt, sha256Hex } from "./crypto.ts";

/*
 * Payload formats:
 * - legacy: JSON entry fields, AES-GCM with no additional data. Tombstones are
 *   unencrypted (`isDeleted: true`, empty payload).
 * - v2: JSON with `v: 2`, `id` and `isDeleted` inside, AES-GCM with the entry id
 *   as additional data. The server can no longer swap ciphertexts between ids or
 *   flip `isDeleted` without decryption failing.
 *
 * New writes are always v2. Legacy payloads still decrypt so data already on
 * servers, and tombstones from older clients, keep working.
 */
const PAYLOAD_VERSION = 2;

function aad(id: string): string {
  return `workledger:entry:${id}`;
}

// The server requires a 64-hex integrityHash. A hash of the plaintext leaked
// content equality, and AES-GCM already authenticates, so hash the ciphertext:
// it satisfies the server and reveals nothing the server doesn't already hold.
function ciphertextHash(encryptedPayload: string): Promise<string> {
  return sha256Hex(encryptedPayload);
}

export async function encryptEntry(key: CryptoKey, entry: WorkLedgerEntry): Promise<SyncEntry> {
  const plaintext = JSON.stringify({
    v: PAYLOAD_VERSION,
    id: entry.id,
    isDeleted: false,
    dayKey: entry.dayKey,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    blocks: entry.blocks,
    isArchived: entry.isArchived,
    tags: entry.tags ?? [],
    isPinned: entry.isPinned ?? false,
    signifier: entry.signifier,
  });
  const encryptedPayload = await encrypt(key, plaintext, aad(entry.id));
  return {
    id: entry.id,
    updatedAt: entry.updatedAt,
    isArchived: entry.isArchived,
    isDeleted: false,
    encryptedPayload,
    integrityHash: await ciphertextHash(encryptedPayload),
  };
}

export async function encryptTombstone(key: CryptoKey, id: string, updatedAt: number): Promise<SyncEntry> {
  const plaintext = JSON.stringify({ v: PAYLOAD_VERSION, id, isDeleted: true, updatedAt });
  const encryptedPayload = await encrypt(key, plaintext, aad(id));
  return {
    id,
    updatedAt,
    isArchived: false,
    isDeleted: true,
    encryptedPayload,
    integrityHash: await ciphertextHash(encryptedPayload),
  };
}

async function decryptPayload(key: CryptoKey, syncEntry: SyncEntry): Promise<Record<string, unknown>> {
  try {
    const payload = JSON.parse(await decrypt(key, syncEntry.encryptedPayload, aad(syncEntry.id)));
    if (payload.v !== PAYLOAD_VERSION || payload.id !== syncEntry.id) {
      throw new Error("payload does not match entry id");
    }
    return payload;
  } catch (v2Error) {
    let legacy: Record<string, unknown>;
    try {
      legacy = JSON.parse(await decrypt(key, syncEntry.encryptedPayload));
    } catch {
      throw v2Error;
    }
    // A versioned payload must never be accepted without its additional data.
    if ("v" in legacy) throw new Error("versioned payload without additional data");
    return legacy;
  }
}

export async function decryptEntry(key: CryptoKey, syncEntry: SyncEntry): Promise<RemoteEntry> {
  if (syncEntry.isDeleted && !syncEntry.encryptedPayload) {
    // Legacy tombstone from an older client. Unauthenticated, accepted for compatibility.
    return { id: syncEntry.id, isDeleted: true, updatedAt: syncEntry.updatedAt };
  }

  const payload = await decryptPayload(key, syncEntry);
  const isVersioned = payload.v === PAYLOAD_VERSION;
  const isDeleted = isVersioned ? payload.isDeleted === true : syncEntry.isDeleted;
  if (isVersioned && isDeleted !== syncEntry.isDeleted) {
    throw new Error("isDeleted metadata does not match encrypted payload");
  }
  const updatedAt = typeof payload.updatedAt === "number" ? payload.updatedAt : syncEntry.updatedAt;
  if (isDeleted) return { id: syncEntry.id, isDeleted: true, updatedAt };

  // Unknown keys (v, isDeleted) are stripped by entry validation on apply.
  return { id: syncEntry.id, isDeleted: false, updatedAt, data: { ...payload, id: syncEntry.id } };
}

/** Decrypt a page in parallel. Undecryptable entries are logged and skipped. */
export async function decryptAll(key: CryptoKey, entries: SyncEntry[]): Promise<RemoteEntry[]> {
  const results = await Promise.allSettled(entries.map((e) => decryptEntry(key, e)));
  const decrypted: RemoteEntry[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      decrypted.push(r.value);
    } else {
      const reason = r.reason instanceof Error ? r.reason.message : r.reason;
      console.warn(`[sync] Failed to decrypt entry ${entries[i].id}:`, reason);
    }
  });
  return decrypted;
}
