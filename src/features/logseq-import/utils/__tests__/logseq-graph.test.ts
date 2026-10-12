import { describe, it, expect } from "vitest";
import type { PartialBlock } from "@blocknote/core";
import { convertGraph, pageTitleFromFileName, parseJournalDate, type GraphFile } from "../logseq-graph.ts";

/** Stand-in for BlockNote: one paragraph per non-empty line, markdown links become link inline content. */
function fakeParse(markdown: string): PartialBlock[] {
  return markdown
    .split("\n")
    .map((line) => line.replace(/^\s*- (\[[ x]\] )?/, ""))
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const content: Record<string, unknown>[] = [];
      let rest = line;
      for (const m of line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        const [before] = rest.split(m[0]);
        if (before) content.push({ type: "text", text: before, styles: {} });
        content.push({ type: "link", href: m[2], content: [{ type: "text", text: m[1], styles: {} }] });
        rest = rest.slice(before.length + m[0].length);
      }
      if (rest) content.push({ type: "text", text: rest, styles: {} });
      return { type: "paragraph", content } as PartialBlock;
    });
}

const options = { parseMarkdown: fakeParse, makeId: async (key: string) => `id:${key}`, now: 5 };
const file = (relativePath: string, text: string, lastModified = Date.UTC(2024, 0, 10, 12)): GraphFile => ({ relativePath, text, lastModified });

describe("convertGraph", () => {
  it("puts journals on their date and pages on their modified day with a title heading", async () => {
    const { entries } = await convertGraph(
      [file("g/journals/2024_06_15.md", "- standup notes"), file("g/pages/Project X.md", "- goals")],
      options,
    );
    const journal = entries.find((e) => e.id === "id:g/journals/2024_06_15.md")!;
    const page = entries.find((e) => e.id === "id:g/pages/Project X.md")!;
    expect(journal.dayKey).toBe("2024-06-15");
    expect(journal.blocks[0]).toMatchObject({ type: "paragraph" });
    expect(page.dayKey).toBe("2024-01-10");
    expect(page.blocks[0]).toMatchObject({ type: "heading", content: "Project X" });
  });

  it("links pages by title, alias and journal title, case-insensitively", async () => {
    const { entries } = await convertGraph(
      [
        file("g/pages/Postgres.md", "alias:: pg\n\n- notes"),
        file("g/journals/2024_06_14.md", "- yesterday"),
        file("g/journals/2024_06_15.md", "- [[postgres]] and [[PG]] since [[Jun 14th, 2024]], not [[Missing]]"),
      ],
      options,
    );
    const day = entries.find((e) => e.dayKey === "2024-06-15")!;
    const content = (day.blocks[0] as { content: Record<string, unknown>[] }).content;
    const links = content.filter((i) => i.type === "entryLink").map((i) => (i.props as { entryId: string }).entryId);
    expect(links).toEqual(["id:g/pages/Postgres.md", "id:g/pages/Postgres.md", "id:g/journals/2024_06_14.md"]);
    // A page that has no file in the graph stays as plain text.
    expect(content.some((i) => i.type === "text" && i.text === "Missing")).toBe(true);
    expect(content.some((i) => i.type === "link")).toBe(false);
  });

  it("skips empty journals, backups and files outside journals/ and pages/", async () => {
    const result = await convertGraph(
      [
        file("g/journals/2024_06_16.md", "- "),
        file("g/logseq/bak/pages/Old.md", "- stale copy"),
        file("g/README.md", "- not a page"),
        file("g/pages/Real.md", "- content"),
      ],
      options,
    );
    expect(result.entries.map((e) => e.id)).toEqual(["id:g/pages/Real.md"]);
    expect(result.skippedFiles).toBe(3);
  });

  it("uses the title property and merges tags", async () => {
    const { entries } = await convertGraph([file("g/pages/proj___infra.md", "title:: Infra Roadmap\ntags:: Work\n\n- #Infra item")], options);
    expect(entries[0].blocks[0]).toMatchObject({ content: "Infra Roadmap" });
    expect(entries[0].tags.sort()).toEqual(["infra", "work"]);
  });
});

describe("file names", () => {
  it("decodes namespaced and legacy URL-encoded page names", () => {
    expect(pageTitleFromFileName("proj___infra.md")).toBe("proj/infra");
    expect(pageTitleFromFileName("proj%2Finfra.md")).toBe("proj/infra");
    expect(pageTitleFromFileName("100%.md")).toBe("100%");
  });

  it("parses journal file names", () => {
    expect(parseJournalDate("2024_06_15.md")?.getDate()).toBe(15);
    expect(parseJournalDate("2024-06-15.md")?.getMonth()).toBe(5);
    expect(parseJournalDate("notes.md")).toBeUndefined();
  });
});
