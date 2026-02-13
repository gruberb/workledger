import { useCallback, useEffect, useMemo, useRef } from "react";
import { filterSuggestionItems, SuggestionMenu } from "@blocknote/core/extensions";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController } from "@blocknote/react";
import "@blocknote/mantine/style.css";

import { workledgerSchema } from "./EditorProvider.tsx";
import { getWorkLedgerSlashMenuItems } from "./SlashMenuItems.tsx";
import { getWikiLinkMenuItems } from "./WikiLinkMenuItems.ts";
import type { WorkLedgerEntry } from "../../entries/types/entry.ts";
import { useAutoSave } from "../../entries/hooks/useAutoSave.ts";
import { useThemeMode } from "../../theme/context/ThemeContext.tsx";

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
  const themeMode = useThemeMode();
  const initialContent = useMemo(
    () => (entry.blocks.length > 0 ? entry.blocks : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.id],
  );

  const editor = useCreateBlockNote(
    {
      schema: workledgerSchema,
      initialContent: initialContent as never,
      placeholders: {
        default: "Type text, / for commands, [[ to link entries",
      },
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

  // Workaround: BlockNote's handleTextInput fails to detect [[ mid-text
  // because it reads triggerLength+1 chars and compares to triggerLength chars.
  // We attach to the wrapper div (via ref) so we don't depend on editor.domElement timing.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "[") return;

      // Defer check until after ProseMirror has fully processed the keystroke
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        const suggestionMenuExt = editor.getExtension(SuggestionMenu);
        if (!suggestionMenuExt || suggestionMenuExt.shown()) return;

        const view = editor.prosemirrorView;
        const { from } = view.state.selection;
        if (from < 2) return;

        try {
          const twoBefore = view.state.doc.textBetween(from - 2, from);
          if (twoBefore === "[[") {
            // Delete the [[ the user typed, then let openSuggestionMenu re-insert it
            // with deleteTriggerCharacter: true so it gets removed on item select.
            view.dispatch(view.state.tr.delete(from - 2, from));
            suggestionMenuExt.openSuggestionMenu("[[", {
              deleteTriggerCharacter: true,
            });
          }
        } catch {
          // ignore textBetween errors near node boundaries
        }
      }, 0);
    };

    wrapper.addEventListener("keydown", handleKeyDown);
    return () => {
      wrapper.removeEventListener("keydown", handleKeyDown);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [editor]);

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

  const wikiLinkItems = useCallback(
    async (query: string) => getWikiLinkMenuItems(query, entry.id),
    [entry.id],
  );

  const handleWikiLinkSelect = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (item: any) => {
      (editor as never as { insertInlineContent: (content: unknown[]) => void }).insertInlineContent([
        {
          type: "entryLink",
          props: {
            entryId: item.entryId,
            displayText: item.displayText,
          },
        },
        " ",
      ]);
    },
    [editor],
  );

  return (
    <div
      ref={wrapperRef}
      className="entry-editor"
      data-autofocus={autoFocus ? "true" : undefined}
    >
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={themeMode}
        onChange={onChange}
        slashMenu={false}
        data-workledger-editor
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={slashMenuItems}
        />
        <SuggestionMenuController
          triggerCharacter="[["
          getItems={wikiLinkItems}
          onItemClick={handleWikiLinkSelect}
        />
      </BlockNoteView>
    </div>
  );
}
