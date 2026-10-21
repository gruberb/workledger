// Public API for the AI feature: fully self-contained, deletable.
// AISidebar is exported from ./sidebar.ts instead, so importing this file
// does not pull react-markdown into the main bundle.
export { AIProvider, useAIContext } from "./context/AIContext.tsx";
export type { NoteActions } from "./types/ai.ts";
