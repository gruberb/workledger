// Public API for the editor feature
export { EntryEditor } from "./components/EntryEditor.tsx";
// For headless parsing into WorkLedger blocks (e.g. importers)
export { workledgerSchema } from "./components/EditorProvider.tsx";
// Turns AI replies into blocks ("Add to note")
export { markdownToBlocks } from "./utils/markdown-blocks.ts";
