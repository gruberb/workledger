import { describe, it, expect } from "vitest";
import type { WorkLedgerEntry } from "../../types/entry.ts";
import { collectKnownTags, suggestTags } from "../tag-suggestions.ts";

function entry(id: string, tags: string[]): WorkLedgerEntry {
  return { id, dayKey: "2026-10-12", createdAt: 1, updatedAt: 1, blocks: [], isArchived: false, tags };
}

describe("collectKnownTags", () => {
  it("merges stored tags with tags of loaded entries, without duplicates", () => {
    const loaded = new Map([["2026-10-12", [entry("a", ["new", "sync"]), entry("b", [])]]]);
    expect(collectKnownTags(["sync", "old"], loaded).sort()).toEqual(["new", "old", "sync"]);
  });
});

describe("suggestTags", () => {
  const known = ["workledger", "work", "ux", "meeting", "Network", "sync"];

  it("lists prefix matches before substring matches, alphabetically", () => {
    expect(suggestTags(known, "wor", [], 10)).toEqual(["work", "workledger", "Network"]);
  });

  it("matches case-insensitively", () => {
    expect(suggestTags(known, "NET", [], 10)).toEqual(["Network"]);
  });

  it("leaves out tags the entry already has", () => {
    expect(suggestTags(known, "work", ["work"], 10)).toEqual(["workledger", "Network"]);
  });

  it("offers everything for an empty query, up to the limit", () => {
    expect(suggestTags(known, "  ", [], 3)).toEqual(["meeting", "Network", "sync"]);
  });

  it("returns nothing when no tag matches", () => {
    expect(suggestTags(known, "zzz", [], 10)).toEqual([]);
  });
});
