import { describe, it, expect, vi } from "vitest";
import { pushEntries, pullEntries } from "../sync-operations.ts";
import { SyncHttpError, type SyncApi } from "../sync-api.ts";
import { deriveKey } from "../crypto.ts";
import { encryptEntry } from "../sync-crypto.ts";
import type { PullResponse, SyncEntry } from "../../types/sync.ts";
import type { WorkLedgerEntry } from "../../../entries/index.ts";

const ctx = { serverUrl: null, timeoutMs: 1000 };
const key = await deriveKey("wl-test-ops", btoa("0123456789abcdef"));

function entry(id: string, text = "hello"): WorkLedgerEntry {
  return {
    id,
    dayKey: "2025-06-15",
    createdAt: 1000,
    updatedAt: 2000,
    blocks: [{ type: "paragraph", content: [{ type: "text", text }] }],
    isArchived: false,
    tags: [],
    isPinned: false,
  };
}

function fakeApi(overrides: Partial<SyncApi> = {}): SyncApi {
  return {
    createAccount: vi.fn(),
    validateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    pushEntries: vi.fn(async () => ({ serverSeq: 1 })),
    pullEntries: vi.fn(),
    ...overrides,
  };
}

function pushParams(api: SyncApi, entries: WorkLedgerEntry[], tombstoneIds: string[] = [], maxEntries = 100, maxBytes = 1_000_000) {
  return {
    api, ctx, key, token: "t", entries, tombstoneIds,
    limits: { maxEntries, maxBytes },
    onBatchPushed: vi.fn(),
    assertCurrent: vi.fn(),
  };
}

describe("pushEntries", () => {
  it("splits into batches by entry count", async () => {
    const api = fakeApi();
    const params = pushParams(api, ["a", "b", "c", "d", "e"].map((id) => entry(id)), [], 2);
    const result = await pushEntries(params);
    expect(result.pushed).toBe(5);
    const batches = vi.mocked(api.pushEntries).mock.calls.map((c) => c[2].map((e) => e.id));
    expect(batches).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(params.onBatchPushed).toHaveBeenCalledTimes(3);
  });

  it("splits into batches by serialized size", async () => {
    const api = fakeApi();
    const big = "x".repeat(2000);
    await pushEntries(pushParams(api, [entry("a", big), entry("b", big), entry("c", big)], [], 100, 4000));
    const batches = vi.mocked(api.pushEntries).mock.calls.map((c) => c[2].length);
    expect(batches.every((n) => n <= 1)).toBe(true);
    expect(batches).toHaveLength(3);
  });

  it("sends encrypted tombstones with a payload", async () => {
    const api = fakeApi();
    await pushEntries(pushParams(api, [], ["gone"]));
    const sent = vi.mocked(api.pushEntries).mock.calls[0][2][0];
    expect(sent).toMatchObject({ id: "gone", isDeleted: true });
    expect(sent.encryptedPayload).not.toBe("");
    expect(sent.integrityHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps progress of earlier batches when a later batch fails", async () => {
    let call = 0;
    const api = fakeApi({
      pushEntries: vi.fn(async () => {
        if (++call === 2) throw new SyncHttpError(500, "boom");
        return { serverSeq: call };
      }),
    });
    const params = pushParams(api, ["a", "b", "c"].map((id) => entry(id)), [], 1);
    await expect(pushEntries(params)).rejects.toThrow("boom");
    expect(params.onBatchPushed).toHaveBeenCalledTimes(1);
    expect(params.onBatchPushed).toHaveBeenCalledWith(["a"]);
  });

  it("skips a single entry the server rejects as too large", async () => {
    const api = fakeApi({
      pushEntries: vi.fn(async (_c, _t, batch: SyncEntry[]) => {
        if (batch[0].id === "huge") throw new SyncHttpError(413, "too large");
        return { serverSeq: 1 };
      }),
    });
    const result = await pushEntries(pushParams(api, [entry("huge"), entry("ok")], [], 1));
    expect(result).toEqual({ pushed: 1, rejected: ["huge"] });
  });

  it("stops between batches when the operation became stale", async () => {
    const api = fakeApi();
    const params = pushParams(api, ["a", "b"].map((id) => entry(id)), [], 1);
    params.assertCurrent.mockImplementationOnce(() => undefined).mockImplementationOnce(() => { throw new Error("stale"); });
    await expect(pushEntries(params)).rejects.toThrow("stale");
    expect(api.pushEntries).toHaveBeenCalledTimes(1);
  });
});

describe("pullEntries", () => {
  async function page(entries: Array<{ id: string; seq?: number }>, serverSeq: number, hasMore: boolean): Promise<PullResponse> {
    const encrypted = await Promise.all(entries.map(async (e) => ({ ...(await encryptEntry(key, entry(e.id))), serverSeq: e.seq })));
    return { entries: encrypted, serverSeq, hasMore };
  }

  it("advances by the per-page cursor and ends at the server seq", async () => {
    const pages = [await page([{ id: "a", seq: 1 }, { id: "b", seq: 2 }], 9, true), await page([{ id: "c", seq: 3 }], 9, false)];
    const api = fakeApi({ pullEntries: vi.fn(async () => pages.shift()!) });
    const apply = vi.fn(async (r: unknown[]) => r.length);
    const result = await pullEntries({ api, ctx, key, token: "t", since: 0, pageSize: 2, apply });
    expect(vi.mocked(api.pullEntries).mock.calls.map((c) => c[2])).toEqual([0, 2]);
    expect(result).toEqual({ cursor: 9, merged: 3 });
  });

  it("returns the per-page cursor, not the global seq, when the cursor is stuck", async () => {
    const api = fakeApi({ pullEntries: vi.fn(async () => page([{ id: "a", seq: 5 }], 50, true)) });
    const result = await pullEntries({ api, ctx, key, token: "t", since: 5, pageSize: 1, apply: async () => 0 });
    expect(result.cursor).toBe(5);
    expect(api.pullEntries).toHaveBeenCalledTimes(1);
  });

  it("does not apply anything when the page fails", async () => {
    const api = fakeApi({ pullEntries: vi.fn(async () => { throw new SyncHttpError(503, "down"); }) });
    const apply = vi.fn();
    await expect(pullEntries({ api, ctx, key, token: "t", since: 0, pageSize: 1, apply })).rejects.toThrow("down");
    expect(apply).not.toHaveBeenCalled();
  });
});
