import { describe, it, expect } from "vitest";
import { applyPatch, nextUpdatedAt, normalizeEntry } from "../entries.ts";
import { validateEntry } from "../../utils/validation.ts";
import { upgradeLegacyEntry } from "../../../../storage/db.ts";
import type { WorkLedgerEntry } from "../../types/entry.ts";

const base: WorkLedgerEntry = {
  id: "e1",
  dayKey: "2026-01-01",
  createdAt: 1000,
  updatedAt: 5000,
  blocks: [{ type: "paragraph" }],
  isArchived: false,
  tags: ["a"],
  isPinned: false,
};

describe("nextUpdatedAt", () => {
  it("uses the clock when it is ahead", () => {
    expect(nextUpdatedAt(5000, 9000)).toBe(9000);
  });

  it("still moves forward when the local clock lags the stored version", () => {
    expect(nextUpdatedAt(5000, 1000)).toBe(5001);
    expect(nextUpdatedAt(5000, 5000)).toBe(5001);
  });
});

describe("applyPatch", () => {
  it("changes only patched fields and bumps updatedAt", () => {
    const patched = applyPatch(base, { tags: ["b"] }, 1000);
    expect(patched.tags).toEqual(["b"]);
    expect(patched.blocks).toBe(base.blocks);
    expect(patched.updatedAt).toBe(5001);
  });

  it("clears a field set to undefined", () => {
    const patched = applyPatch({ ...base, signifier: "idea" }, { signifier: undefined }, 9000);
    expect(patched.signifier).toBeUndefined();
  });
});

describe("removed signifiers", () => {
  it("normalizeEntry drops values that are no longer valid", () => {
    expect(normalizeEntry({ ...base, signifier: "note" }).signifier).toBeUndefined();
    expect(normalizeEntry({ ...base, signifier: "idea" }).signifier).toBe("idea");
  });

  it("validateEntry maps unknown signifiers to undefined instead of rejecting", () => {
    expect(validateEntry({ ...base, signifier: "task" }).signifier).toBeUndefined();
    expect(validateEntry({ ...base, signifier: "milestone" }).signifier).toBe("milestone");
  });
});

describe("upgradeLegacyEntry (DB v5 migration)", () => {
  const stored = { ...base, blocks: [] as unknown[] };

  it("strips removed signifiers and backfills isPinned", () => {
    const upgraded = upgradeLegacyEntry({ ...stored, isPinned: undefined, signifier: "note" });
    expect(upgraded).not.toBeNull();
    expect(upgraded).not.toHaveProperty("signifier");
    expect(upgraded?.isPinned).toBe(false);
  });

  it("returns null for entries that need no change", () => {
    expect(upgradeLegacyEntry({ ...stored, signifier: "decision" })).toBeNull();
  });
});

describe("Small win compatibility", () => {
  it("survives export/import validation and remote entry normalization", () => {
    const entry = { ...base, signifier: "small-win" };
    expect(validateEntry(JSON.parse(JSON.stringify(entry))).signifier).toBe("small-win");
    expect(normalizeEntry(entry).signifier).toBe("small-win");
  });
});
