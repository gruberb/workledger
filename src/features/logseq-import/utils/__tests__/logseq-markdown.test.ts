import { describe, it, expect } from "vitest";
import { collectBlockRefs, convertLogseqMarkdown, parsePropertyList, PAGE_LINK_PREFIX, type BlockRefs } from "../logseq-markdown.ts";

const link = (label: string, page = label) => `[${label}](${PAGE_LINK_PREFIX}${encodeURIComponent(page)})`;

describe("convertLogseqMarkdown", () => {
  it("harvests page properties and drops them from the body", () => {
    const page = convertLogseqMarkdown("title:: Project X\ntags:: [[Work]], infra\nalias:: px\n\n- first block", new Map());
    expect(page.properties).toEqual({ title: "Project X", tags: "[[Work]], infra", alias: "px" });
    expect(page.tags.sort()).toEqual(["infra", "work"]);
    expect(page.markdown).toBe("- first block");
  });

  it("treats a leading property-only bullet as page properties", () => {
    const page = convertLogseqMarkdown("- tags:: ops\n  type:: note\n- body", new Map());
    expect(page.properties).toEqual({ tags: "ops", type: "note" });
    expect(page.markdown).toBe("- body");
  });

  it("drops block properties but keeps their tags", () => {
    const page = convertLogseqMarkdown("- parent\n\t- child\n\t  id:: 64f0c1a2-0000-4000-8000-000000000000\n\t  collapsed:: true\n\t  tags:: deep", new Map());
    expect(page.markdown).toBe("- parent\n  - child");
    expect(page.tags).toEqual(["deep"]);
  });

  it("maps task markers to task list items", () => {
    const page = convertLogseqMarkdown("- TODO write\n- DOING [#A] review\n- DONE ship\n- CANCELED drop it", new Map());
    expect(page.markdown).toBe("- [ ] write\n- [ ] review\n- [x] ship\n- [x] ~~drop it~~");
  });

  it("turns page links into placeholder links and collects hashtags", () => {
    const page = convertLogseqMarkdown("- met [[Alice Smith]] about [the plan]([[Q3 Plan]]) #infra #[[on call]]", new Map());
    expect(page.markdown).toBe(`- met ${link("Alice Smith")} about ${link("the plan", "Q3 Plan")} #infra #on call`);
    expect(page.tags.sort()).toEqual(["infra", "on call"]);
  });

  it("resolves block refs and embeds, and keeps other macros visible", () => {
    const refs: BlockRefs = new Map();
    collectBlockRefs("- TODO decide on [[Postgres]]\n  id:: 64F0C1A2-0000-4000-8000-000000000001", refs);
    const page = convertLogseqMarkdown(
      "- see ((64f0c1a2-0000-4000-8000-000000000001))\n- {{embed ((64f0c1a2-0000-4000-8000-000000000001))}}\n- ((64f0c1a2-0000-4000-8000-00000000ffff))\n- {{query (todo now)}}\n- {{embed [[Postgres]]}}",
      refs,
    );
    expect(page.markdown).toBe(
      `- see decide on Postgres\n- decide on Postgres\n- (block reference)\n- \`{{query (todo now)}}\`\n- ${link("Postgres")}`,
    );
  });

  it("replaces local asset images but keeps remote ones", () => {
    const page = convertLogseqMarkdown("- ![diagram](../assets/arch_1.png)\n- ![](https://example.com/x.png)", new Map());
    expect(page.markdown).toBe("- *[image not imported: diagram]*\n- ![](https://example.com/x.png)");
    expect(page.skippedAssets).toBe(1);
  });

  it("leaves fenced code untouched", () => {
    const source = "- snippet\n  ```\n  key:: value [[not a link]] #nottag\n  ```";
    const page = convertLogseqMarkdown(source, new Map());
    expect(page.markdown).toBe(source);
    expect(page.tags).toEqual([]);
  });
});

describe("parsePropertyList", () => {
  it("splits links, hashtags and plain values", () => {
    expect(parsePropertyList("[[a b]], c, #d")).toEqual(["a b", "c", "d"]);
  });
});
