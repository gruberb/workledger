import type { SyncEntry } from "../types/sync.ts";
import type { RemoteEntry, WorkLedgerEntry } from "../../entries/index.ts";
import { SyncHttpError, type ApiContext, type SyncApi } from "./sync-api.ts";
import { encryptEntry, encryptTombstone, decryptAll } from "./sync-crypto.ts";

export interface BatchLimits {
  maxEntries: number;
  /** Serialized request size. Must stay below the server's request body limit. */
  maxBytes: number;
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

  const flush = async () => {
    if (batch.length === 0) return;
    const ids = batch.map((e) => e.id);
    assertCurrent();
    try {
      await api.pushEntries(ctx, token, batch);
    } catch (err) {
      // A single entry the server will never accept must not block every later push.
      if (err instanceof SyncHttpError && err.status === 413 && batch.length === 1) {
        console.warn(`[sync] Entry ${ids[0]} is too large to sync`);
        result.rejected.push(ids[0]);
        onBatchPushed(ids);
        batch = [];
        batchBytes = 0;
        return;
      }
      throw err;
    }
    result.pushed += ids.length;
    onBatchPushed(ids);
    batch = [];
    batchBytes = 0;
  };

  const add = async (entry: SyncEntry) => {
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
