import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { excalidrawBlockSpec } from "./ExcalidrawBlock.tsx";

export const workledgerSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    excalidraw: excalidrawBlockSpec() as any,
  },
});

export type WorkLedgerSchema = typeof workledgerSchema;
