import { describe, it, expect } from "vitest";
import { createCodeHighlighter } from "../code-highlighter.ts";

const SAMPLES: Record<string, string> = {
  javascript: "const x = () => 1;",
  typescript: "let x: number = 1;",
  python: "def f(x):\n    return x",
  rust: "fn main() { let x = 1; }",
  go: "func main() { x := 1 }",
  java: "class A { int x = 1; }",
  c: "int main(void) { return 0; }",
  cpp: "template<typename T> T f(T x) { return x; }",
  csharp: "var x = new List<int>();",
  html: "<div class=\"a\"><script>let x = 1;</script></div>",
  css: ".a { color: red; }",
  json: "{\"a\": [1, true, null]}",
  yaml: "a: [1, 2]\nb: c",
  toml: "[a]\nb = 1",
  markdown: "# Title\n\n```js\nlet x = 1\n```",
  bash: "for f in *; do echo \"$f\"; done",
  sql: "SELECT a FROM b WHERE c = 1;",
  ruby: "def f(x) = x * 2",
  php: "<?php echo $x; ?>",
  swift: "let x: Int = 1",
  kotlin: "val x: Int = 1",
  dockerfile: "FROM node:22\nRUN npm ci",
  graphql: "query { user(id: 1) { name } }",
};

describe("createCodeHighlighter", () => {
  it("loads each code block language by id and tokenizes it with the JS regex engine", async () => {
    const highlighter = await createCodeHighlighter();
    for (const [lang, code] of Object.entries(SAMPLES)) {
      await highlighter.loadLanguage(lang);
      expect(highlighter.getLoadedLanguages()).toContain(lang);
      const tokens = highlighter.codeToTokens(code, { lang, theme: "css-variables" });
      expect(tokens.tokens.length, lang).toBeGreaterThan(0);
    }
  }, 30_000);
});
