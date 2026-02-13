import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  createCodeBlockSpec,
} from "@blocknote/core";
import { createHighlighter } from "shiki";
import { createCssVariablesTheme } from "shiki/core";
import { excalidrawBlockSpec } from "../excalidraw/ExcalidrawBlock.tsx";
import { entryLinkSpec } from "../specs/EntryLinkSpec.tsx";

export const workledgerSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec({
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
      createHighlighter: () =>
        createHighlighter({
          themes: [createCssVariablesTheme({ name: "css-variables", variablePrefix: "--shiki-" })],
          langs: [],
        }),
    }),
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
