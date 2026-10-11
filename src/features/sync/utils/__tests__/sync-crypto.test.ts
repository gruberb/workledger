import { describe, it, expect } from "vitest";
import { encryptEntry, encryptTombstone, decryptEntry, decryptAll } from "../sync-crypto.ts";
import { deriveKey, encrypt, sha256Hex } from "../crypto.ts";
import type { SyncEntry } from "../../types/sync.ts";
import type { WorkLedgerEntry } from "../../../entries/index.ts";

async function makeKey() {
  const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  return deriveKey("wl-test-sync-crypto", salt);
}

const sampleEntry: WorkLedgerEntry = {
  id: "entry-123",
  dayKey: "2025-06-15",
  createdAt: 1000000,
  updatedAt: 2000000,
  blocks: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
  isArchived: false,
  tags: ["work", "meeting"],
  isPinned: false,
};

/** What a pre-v2 client wrote: plain entry JSON, no additional data, plaintext hash. */
async function legacyEncrypt(key: CryptoKey, entry: WorkLedgerEntry): Promise<SyncEntry> {
  const { id, ...rest } = entry;
  const plaintext = JSON.stringify(rest);
  return {
    id,
    updatedAt: entry.updatedAt,
    isArchived: entry.isArchived,
    isDeleted: false,
    encryptedPayload: await encrypt(key, plaintext),
    integrityHash: await sha256Hex(plaintext),
  };
}

describe("encryptEntry / decryptEntry", () => {
  it("round-trips an entry", async () => {
    const key = await makeKey();
    const decrypted = await decryptEntry(key, await encryptEntry(key, sampleEntry));
    expect(decrypted).toMatchObject({ id: sampleEntry.id, isDeleted: false, updatedAt: sampleEntry.updatedAt });
    if (decrypted.isDeleted) throw new Error("unexpected tombstone");
    expect(decrypted.data).toMatchObject({
      id: sampleEntry.id,
      dayKey: sampleEntry.dayKey,
      blocks: sampleEntry.blocks,
      tags: sampleEntry.tags,
      isArchived: false,
    });
  });

  it("sends a hash of the ciphertext, not of the plaintext", async () => {
    const key = await makeKey();
    const encrypted = await encryptEntry(key, sampleEntry);
    expect(encrypted.integrityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(encrypted.integrityHash).toBe(await sha256Hex(encrypted.encryptedPayload));
  });

  it("rejects a v2 payload moved to another entry id", async () => {
    const key = await makeKey();
    const encrypted = await encryptEntry(key, sampleEntry);
    await expect(decryptEntry(key, { ...encrypted, id: "other-entry" })).rejects.toThrow();
  });

  it("rejects a v2 entry whose isDeleted flag was flipped by the server", async () => {
    const key = await makeKey();
    const encrypted = await encryptEntry(key, sampleEntry);
    await expect(decryptEntry(key, { ...encrypted, isDeleted: true })).rejects.toThrow();
  });

  it("decrypts legacy payloads already on the server", async () => {
    const key = await makeKey();
    const decrypted = await decryptEntry(key, await legacyEncrypt(key, sampleEntry));
    if (decrypted.isDeleted) throw new Error("unexpected tombstone");
    expect(decrypted.data).toMatchObject({ id: sampleEntry.id, dayKey: sampleEntry.dayKey, blocks: sampleEntry.blocks });
  });

  it("accepts legacy empty tombstones from older clients", async () => {
    const key = await makeKey();
    const decrypted = await decryptEntry(key, {
      id: "del-1", updatedAt: 5000000, isArchived: false, isDeleted: true, encryptedPayload: "", integrityHash: "",
    });
    expect(decrypted).toEqual({ id: "del-1", isDeleted: true, updatedAt: 5000000 });
  });
});

describe("encryptTombstone", () => {
  it("round-trips an authenticated tombstone", async () => {
    const key = await makeKey();
    const tombstone = await encryptTombstone(key, "del-2", 7000);
    expect(tombstone).toMatchObject({ id: "del-2", isDeleted: true, updatedAt: 7000 });
    expect(tombstone.encryptedPayload).not.toBe("");
    expect(await decryptEntry(key, tombstone)).toEqual({ id: "del-2", isDeleted: true, updatedAt: 7000 });
  });

  it("rejects a tombstone moved to another entry id", async () => {
    const key = await makeKey();
    const tombstone = await encryptTombstone(key, "del-2", 7000);
    await expect(decryptEntry(key, { ...tombstone, id: "victim" })).rejects.toThrow();
  });

  it("rejects a tombstone presented as a live entry", async () => {
    const key = await makeKey();
    const tombstone = await encryptTombstone(key, "del-2", 7000);
    await expect(decryptEntry(key, { ...tombstone, isDeleted: false })).rejects.toThrow();
  });
});

describe("decryptAll", () => {
  it("skips entries that fail to decrypt and keeps the rest", async () => {
    const key = await makeKey();
    const good = await encryptEntry(key, sampleEntry);
    const bad = { ...good, id: "swapped" };
    const result = await decryptAll(key, [good, bad]);
    expect(result.map((r) => r.id)).toEqual([sampleEntry.id]);
  });
});
