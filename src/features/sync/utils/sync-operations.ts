import type { SyncEntry } from "../types/sync.ts";
import type { RemoteEntry, WorkLedgerEntry } from "../../entries/index.ts";
import { SyncHttpError, type ApiContext, type SyncApi } from "./sync-api.ts";
import { encryptEntry, encryptTombstone, decryptAll } from "./sync-crypto.ts";

export interface BatchLimits {
  maxEntries: number;
  /** Serialized request size. Must stay below the server's request body limit. */
  maxBytes: number;
  /** Largest `encryptedPayload` the server accepts; bigger entries are skipped without sending. */
  maxPayloadChars: number;
}

interface PushParams {
  api: SyncApi;
  ctx: ApiContext;
  key: CryptoKey;
  token: string;
  entries: WorkLedgerEntry[];
  tombstoneIds: string[];
  limits: BatchLimits;
  /** Called after each accepted batch so progress survives a later failure. */
  onBatchPushed: (ids: string[]) => void;
  /** Throws to stop between batches, e.g. after a disconnect. */
  assertCurrent: () => void;
}

export interface PushResult {
  pushed: number;
  /** Entries the server refused as too large. They are skipped, not retried. */
  rejected: string[];
}

/**
 * Encrypt and push in batches. Encrypting per batch keeps memory flat for large
 * notebooks, and batching keeps each request under the server body limit.
 */
export async function pushEntries(params: PushParams): Promise<PushResult> {
  const { api, ctx, key, token, entries, tombstoneIds, limits, onBatchPushed, assertCurrent } = params;
  const result: PushResult = { pushed: 0, rejected: [] };
  let batch: SyncEntry[] = [];
  let batchBytes = 0;

  // An entry the server will never accept must not block every later push.
  const reject = (id: string) => {
    console.warn(`[sync] Entry ${id} is too large to sync`);
    result.rejected.push(id);
    onBatchPushed([id]);
  };

  const send = async (entries: SyncEntry[]): Promise<void> => {
    assertCurrent();
    try {
      await api.pushEntries(ctx, token, entries);
    } catch (err) {
      if (!(err instanceof SyncHttpError && err.status === 413)) throw err;
      // The server rejects the whole batch for one oversized entry (or when
      // its limits are lower than ours). Split until the culprit is alone.
      if (entries.length === 1) {
        reject(entries[0].id);
        return;
      }
      const mid = Math.ceil(entries.length / 2);
      await send(entries.slice(0, mid));
      await send(entries.slice(mid));
      return;
    }
    result.pushed += entries.length;
    onBatchPushed(entries.map((e) => e.id));
  };

  const flush = async () => {
    if (batch.length === 0) return;
    const toSend = batch;
    batch = [];
    batchBytes = 0;
    await send(toSend);
  };

  const add = async (entry: SyncEntry) => {
    if (entry.encryptedPayload.length > limits.maxPayloadChars) {
      reject(entry.id);
      return;
    }
    const size = JSON.stringify(entry).length + 1;
    if (batch.length > 0 && (batch.length >= limits.maxEntries || batchBytes + size > limits.maxBytes)) {
      await flush();
    }
    batch.push(entry);
    batchBytes += size;
  };

  // Deletion time is push time: an older timestamp could lose LWW on the server
  // against the entry's own last edit and leave the entry alive there.
  const now = Date.now();
  for (const id of tombstoneIds) await add(await encryptTombstone(key, id, now));
  for (const entry of entries) await add(await encryptEntry(key, entry));
  await flush();
  return result;
}

interface PullParams {
  api: SyncApi;
  ctx: ApiContext;
  key: CryptoKey;
  token: string;
  since: number;
  pageSize: number;
  /** Applies a decrypted page locally and returns how many entries changed. */
  apply: (entries: RemoteEntry[]) => Promise<number>;
  onMerging?: () => void;
}

export interface PullResult {
  /** Next pull cursor. */
  cursor: number;
  merged: number;
}

export async function pullEntries(params: PullParams): Promise<PullResult> {
  const { api, ctx, key, token, pageSize, apply, onMerging } = params;
  let since = params.since;
  let merged = 0;

  for (;;) {
    const res = await api.pullEntries(ctx, token, since, pageSize);

    if (res.entries.length > 0) {
      onMerging?.();
      merged += await apply(await decryptAll(key, res.entries));

      // Advance to the page's last entry (pages are ordered by server_seq).
      // res.serverSeq is the global max and would skip intermediate pages.
      const lastSeq = res.entries[res.entries.length - 1].serverSeq;
      if (res.hasMore && (lastSeq === undefined || lastSeq <= since)) {
        // Return the per-page cursor: jumping to the global seq here would
        // permanently skip the remaining pages.
        console.warn("[sync] Pull cursor stuck, stopping pagination");
        return { cursor: since, merged };
      }
      if (lastSeq !== undefined && lastSeq > since) since = lastSeq;
    }

    if (!res.hasMore) {
      // The server returns the last page and its seq atomically, so nothing
      // between `since` and res.serverSeq is missing.
      return { cursor: Math.max(since, res.serverSeq), merged };
    }
  }
}
