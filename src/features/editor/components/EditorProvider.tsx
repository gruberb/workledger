import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  createCodeBlockSpec,
} from "@blocknote/core";
import { excalidrawBlockSpec } from "../excalidraw/ExcalidrawBlock.tsx";
import { entryLinkSpec } from "../specs/EntryLinkSpec.tsx";
import { resolveCodeLanguage, type CodeLanguage } from "../utils/code-languages.ts";

const CODE_BLOCK_OPTIONS: { defaultLanguage: string; supportedLanguages: Record<string, CodeLanguage> } = {
  defaultLanguage: "text",
  supportedLanguages: {
    text: { name: "Plain Text", aliases: ["plaintext", "txt"] },
    javascript: { name: "JavaScript", aliases: ["js"] },
    typescript: { name: "TypeScript", aliases: ["ts"] },
    python: { name: "Python", aliases: ["py"] },
    rust: { name: "Rust", aliases: ["rs"] },
    go: { name: "Go", aliases: ["golang"] },
    java: { name: "Java" },
    c: { name: "C" },
    cpp: { name: "C++", aliases: ["c++"] },
    csharp: { name: "C#", aliases: ["cs", "c#"] },
    html: { name: "HTML" },
    css: { name: "CSS" },
    json: { name: "JSON" },
    yaml: { name: "YAML", aliases: ["yml"] },
    toml: { name: "TOML" },
    markdown: { name: "Markdown", aliases: ["md"] },
    bash: { name: "Bash", aliases: ["sh", "shell", "zsh"] },
    sql: { name: "SQL" },
    ruby: { name: "Ruby", aliases: ["rb"] },
    php: { name: "PHP" },
    swift: { name: "Swift" },
    kotlin: { name: "Kotlin", aliases: ["kt"] },
    dockerfile: { name: "Dockerfile", aliases: ["docker"] },
    graphql: { name: "GraphQL", aliases: ["gql"] },
  },
};

// Normalize the language on the way in (paste, markdown) and on render
// (stored entries from imports, sync or older versions), so an unsupported
// language shows as plain text instead of throwing.
function codeBlockSpec() {
  const spec = createCodeBlockSpec(CODE_BLOCK_OPTIONS);
  const { parse, render } = spec.implementation;
  const toSupported = (language: string | undefined) =>
    resolveCodeLanguage(language, CODE_BLOCK_OPTIONS.supportedLanguages, CODE_BLOCK_OPTIONS.defaultLanguage);
  spec.implementation = {
    ...spec.implementation,
    parse(el) {
      const props = parse?.(el);
      return props && { ...props, language: toSupported(props.language) };
    },
    render(block, editor) {
      const language = toSupported(block.props.language);
      return render.call(
        this,
        language === block.props.language ? block : { ...block, props: { ...block.props, language } },
        editor,
      );
    },
  };
  return spec;
}

export const workledgerSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: codeBlockSpec(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    excalidraw: excalidrawBlockSpec() as any,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entryLink: entryLinkSpec as any,
  },
});

export type WorkLedgerSchema = typeof workledgerSchema;
