import { describe, it, expect } from "vitest";
import type { PartialBlock } from "@blocknote/core";
import type { EntrySignifier, WorkLedgerEntry } from "../../types/entry.ts";
import { closeTask, collectOpenLoops, daysBetween, openTasks } from "../open-loops.ts";

function task(text: string, opts: { id?: string; checked?: boolean; strike?: boolean; children?: PartialBlock[] } = {}): PartialBlock {
  return {
    ...(opts.id && { id: opts.id }),
    type: "checkListItem",
    props: { checked: opts.checked ?? false },
    content: [{ type: "text", text, styles: opts.strike ? { strike: true } : {} }],
    children: opts.children ?? [],
  } as PartialBlock;
}

const heading = (text: string) => ({ type: "heading", props: { level: 1 }, content: text }) as PartialBlock;

function entry(id: string, dayKey: string, blocks: PartialBlock[], opts: { tags?: string[]; signifier?: EntrySignifier; archived?: boolean } = {}): WorkLedgerEntry {
  const createdAt = Date.parse(`${dayKey}T12:00:00`);
  return { id, dayKey, createdAt, updatedAt: createdAt, blocks, isArchived: opts.archived ?? false, tags: opts.tags ?? [], signifier: opts.signifier };
}

const noFilter = { tags: [], signifiers: [] };

describe("openTasks", () => {
  it("lists unchecked, non-empty, not struck-through items, nested ones included", () => {
    const blocks = [
      heading("1:1 Kat"),
      task("Send RFD", { id: "a" }),
      task("Done already", { id: "b", checked: true }),
      task("", { id: "c" }),
      task("Abandoned", { id: "d", strike: true }),
      task("Parent", { id: "e", checked: true, children: [task("Child", { id: "f" })] }),
    ];
    expect(openTasks(blocks)).toEqual([
      { key: "a", text: "Send RFD" },
      { key: "f", text: "Child" },
    ]);
  });

  it("keys blocks without an id by position", () => {
    expect(openTasks([heading("T"), task("No id")])).toEqual([{ key: "@1", text: "No id" }]);
  });

  it("reads link text", () => {
    const block = { id: "l", type: "checkListItem", props: { checked: false }, content: [{ type: "link", href: "https://x.test", content: [{ type: "text", text: "Read doc", styles: {} }] }] } as PartialBlock;
    expect(openTasks([block])).toEqual([{ key: "l", text: "Read doc" }]);
  });
});

describe("closeTask", () => {
  const blocks = [heading("T"), task("Ship it", { id: "a" }), task("Parent", { id: "p", children: [task("Child", { id: "c" })] })];

  it("done checks the item and keeps its text style", () => {
    const next = closeTask(blocks, "a", "done")!;
    expect(next[1]).toMatchObject({ props: { checked: true }, content: [{ text: "Ship it", styles: {} }] });
    expect(openTasks(next).map((t) => t.key)).toEqual(["p", "c"]);
  });

  it("drop checks the item and strikes it through", () => {
    const next = closeTask(blocks, "c", "drop")!;
    const child = (next[2] as { children: PartialBlock[] }).children[0];
    expect(child).toMatchObject({ props: { checked: true }, content: [{ text: "Child", styles: { strike: true } }] });
  });

  it("does not change the caller's blocks or untouched siblings", () => {
    const next = closeTask(blocks, "a", "done")!;
    expect(blocks[1]).toMatchObject({ props: { checked: false } });
    expect(next[2]).toBe(blocks[2]);
  });

  it("handles template items whose content is a plain string", () => {
    const template = [{ type: "checkListItem", content: "Review decision in 2 weeks" }] as PartialBlock[];
    expect(openTasks(template)).toEqual([{ key: "@0", text: "Review decision in 2 weeks" }]);
    const next = closeTask(template, "@0", "drop")!;
    expect(next[0]).toMatchObject({ props: { checked: true }, content: [{ text: "Review decision in 2 weeks", styles: { strike: true } }] });
    expect(openTasks(next)).toEqual([]);
  });

  it("returns null when the item is gone or already closed", () => {
    expect(closeTask(blocks, "missing", "done")).toBeNull();
    expect(closeTask(closeTask(blocks, "a", "done")!, "a", "drop")).toBeNull();
  });

  it("does not close a different block that moved into a position key", () => {
    const noIds = [heading("T"), task("First")];
    // The item at @1 was replaced by a heading since it was listed.
    expect(closeTask([heading("T"), heading("Now a heading")], "@1", "done")).toBeNull();
    expect(closeTask(noIds, "@1", "done")).not.toBeNull();
  });
});

describe("daysBetween", () => {
  it("counts calendar days across month and DST changes", () => {
    expect(daysBetween("2026-11-10", "2026-11-10")).toBe(0);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });
});

describe("collectOpenLoops", () => {
  const today = "2026-11-10";
  const entries = [
    entry("old", "2026-08-01", [heading("Old 1:1"), task("Follow up", { id: "o" })], { tags: ["1-1"] }),
    entry("recent", "2026-11-09", [heading("1:1 Kat"), task("Send doc", { id: "r" })], { tags: ["1-1", "image-service"] }),
    entry("month", "2026-10-20", [heading("Design")], { signifier: "question" }),
    entry("closed", "2026-11-08", [heading("All done"), task("x", { checked: true })]),
    entry("archived", "2026-11-08", [task("Hidden")], { archived: true }),
  ];

  it("groups notes with open items or the question signifier by age, newest first", () => {
    const buckets = collectOpenLoops(entries, today, noFilter);
    expect(buckets.map((b) => [b.label, b.groups.map((g) => g.entry.id)])).toEqual([
      ["Last 7 days", ["recent"]],
      ["Last 30 days", ["month"]],
      ["Older", ["old"]],
    ]);
    expect(buckets[1].groups[0]).toMatchObject({ isQuestion: true, tasks: [], title: "Design", ageDays: 21 });
  });

  it("applies tag (all) and signifier (any) filters", () => {
    const byTag = collectOpenLoops(entries, today, { tags: ["1-1", "image-service"], signifiers: [] });
    expect(byTag.flatMap((b) => b.groups.map((g) => g.entry.id))).toEqual(["recent"]);
    const bySignifier = collectOpenLoops(entries, today, { tags: [], signifiers: ["question", "idea"] });
    expect(bySignifier.flatMap((b) => b.groups.map((g) => g.entry.id))).toEqual(["month"]);
  });
});
