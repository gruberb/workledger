import { createHighlighterCore, createCssVariablesTheme, type HighlighterGeneric, type LanguageInput } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Grammars for the languages offered in code blocks, loaded on first use.
// Importing the full "shiki" bundle instead emits a chunk for each of its
// ~300 languages (all precached by the service worker) plus a 600 kB wasm
// regex engine; the JavaScript engine covers these grammars without wasm.
const LANGUAGE_LOADERS: Record<string, () => LanguageInput> = {
  javascript: () => import("shiki/langs/javascript.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  dockerfile: () => import("shiki/langs/dockerfile.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
};

export async function createCodeHighlighter() {
  const highlighter = await createHighlighterCore({
    themes: [createCssVariablesTheme({ name: "css-variables", variablePrefix: "--shiki-" })],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  // BlockNote loads grammars lazily by calling loadLanguage("<id>"). The core
  // highlighter has no built-in name lookup, so map ids to our loaders here.
  const loadLanguage = highlighter.loadLanguage.bind(highlighter);
  highlighter.loadLanguage = (...langs) =>
    loadLanguage(...langs.map((lang) => (typeof lang === "string" && LANGUAGE_LOADERS[lang] ? LANGUAGE_LOADERS[lang]() : lang)));
  // BlockNote types the highlighter with bundle-style string unions; core uses never.
  return highlighter as unknown as HighlighterGeneric<string, string>;
}
