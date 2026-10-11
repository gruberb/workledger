import { describe, it, expect } from "vitest";
import {
  generateSyncIdLocal,
  computeAuthToken,
  deriveKey,
  encrypt,
  decrypt,
} from "../crypto.ts";

describe("generateSyncIdLocal", () => {
  it("returns a string starting with wl-", () => {
    const id = generateSyncIdLocal();
    expect(id).toMatch(/^wl-[0-9a-f]{20}$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSyncIdLocal()));
    expect(ids.size).toBe(100);
  });
});

describe("computeAuthToken", () => {
  it("returns a 64-char hex string", async () => {
    const token = await computeAuthToken("wl-test123");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", async () => {
    const a = await computeAuthToken("wl-abc");
    const b = await computeAuthToken("wl-abc");
    expect(a).toBe(b);
  });

  it("differs for different inputs", async () => {
    const a = await computeAuthToken("wl-abc");
    const b = await computeAuthToken("wl-xyz");
    expect(a).not.toBe(b);
  });
});

describe("deriveKey", () => {
  it("derives a CryptoKey from syncId and salt", async () => {
    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const key = await deriveKey("wl-testkey", salt);
    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    expect(key.usages).toContain("encrypt");
    expect(key.usages).toContain("decrypt");
  });
});

describe("encrypt / decrypt", () => {
  async function makeKey() {
    const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    return deriveKey("wl-test-e2e", salt);
  }

  it("round-trips a simple string", async () => {
    const key = await makeKey();
    const plaintext = "Hello, World!";
    const ciphertext = await encrypt(key, plaintext);
    const result = await decrypt(key, ciphertext);
    expect(result).toBe(plaintext);
  });

  it("round-trips a JSON payload", async () => {
    const key = await makeKey();
    const payload = { dayKey: "2025-01-15", blocks: [{ type: "paragraph" }], tags: ["test"] };
    const plaintext = JSON.stringify(payload);
    const ciphertext = await encrypt(key, plaintext);
    const result = await decrypt(key, ciphertext);
    expect(JSON.parse(result)).toEqual(payload);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const key = await makeKey();
    const plaintext = "same input";
    const ct1 = await encrypt(key, plaintext);
    const ct2 = await encrypt(key, plaintext);
    expect(ct1).not.toBe(ct2);
    // But both decrypt to the same thing
    expect(await decrypt(key, ct1)).toBe(plaintext);
    expect(await decrypt(key, ct2)).toBe(plaintext);
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = await makeKey();
    const key2 = await makeKey();
    const ciphertext = await encrypt(key1, "secret");
    await expect(decrypt(key2, ciphertext)).rejects.toThrow();
  });

  it("handles empty string", async () => {
    const key = await makeKey();
    const ciphertext = await encrypt(key, "");
    const result = await decrypt(key, ciphertext);
    expect(result).toBe("");
  });

  it("handles unicode content", async () => {
    const key = await makeKey();
    const plaintext = "Unicode: \u00e9\u00e8\u00ea \ud83d\ude80 \u4e16\u754c";
    const ciphertext = await encrypt(key, plaintext);
    const result = await decrypt(key, ciphertext);
    expect(result).toBe(plaintext);
  });

  it("round-trips with matching additional data", async () => {
    const key = await makeKey();
    const ciphertext = await encrypt(key, "secret", "entry-1");
    expect(await decrypt(key, ciphertext, "entry-1")).toBe("secret");
  });

  it("fails when additional data differs or is missing", async () => {
    const key = await makeKey();
    const ciphertext = await encrypt(key, "secret", "entry-1");
    await expect(decrypt(key, ciphertext, "entry-2")).rejects.toThrow();
    await expect(decrypt(key, ciphertext)).rejects.toThrow();
  });
});
