import { useCallback, useEffect, useMemo } from "react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController } from "@blocknote/react";
import "@blocknote/mantine/style.css";

import { workledgerSchema } from "./EditorProvider.tsx";
import { getWorkLedgerSlashMenuItems } from "./SlashMenuItems.tsx";
import type { WorkLedgerEntry } from "../../types/entry.ts";
import { useAutoSave } from "../../hooks/useAutoSave.ts";

interface EntryEditorProps {
  entry: WorkLedgerEntry;
  editable?: boolean;
  onSave: (entry: WorkLedgerEntry) => Promise<void>;
  autoFocus?: boolean;
}

export function EntryEditor({
  entry,
  editable = true,
  onSave,
  autoFocus = false,
}: EntryEditorProps) {
  const initialContent = useMemo(
    () => (entry.blocks.length > 0 ? entry.blocks : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.id],
  );

  const editor = useCreateBlockNote(
    {
      schema: workledgerSchema,
      initialContent: initialContent as never,
    },
    [entry.id],
  );

  const { handleChange } = useAutoSave(entry, onSave);

  useEffect(() => {
    if (autoFocus && editor) {
      // Small delay to ensure the editor DOM is ready after render
      const timer = setTimeout(() => {
        try {
          editor.focus();
        } catch {
          // ignore if focus fails
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, editor]);

  const onChange = useCallback(() => {
    handleChange(editor as never);
  }, [handleChange, editor]);

  const slashMenuItems = useMemo(
    () => async (query: string) => {
      const items = getWorkLedgerSlashMenuItems(editor as never);
      return filterSuggestionItems(items, query);
    },
    [editor],
  );

  return (
    <div
      className="entry-editor"
      data-autofocus={autoFocus ? "true" : undefined}
    >
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="light"
        onChange={onChange}
        slashMenu={false}
        data-workledger-editor
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={slashMenuItems}
        />
      </BlockNoteView>
    </div>
  );
}
