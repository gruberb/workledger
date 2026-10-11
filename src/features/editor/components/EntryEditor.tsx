import { useCallback, useEffect, useMemo, useRef } from "react";
import { filterSuggestionItems, SuggestionMenu } from "@blocknote/core/extensions";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { SuggestionMenuController } from "@blocknote/react";
import "@blocknote/mantine/style.css";

import { workledgerSchema } from "./EditorProvider.tsx";
import { getWorkLedgerSlashMenuItems } from "./SlashMenuItems.tsx";
import { getWikiLinkMenuItems } from "./WikiLinkMenuItems.ts";
import { runPreSave } from "../utils/pre-save.ts";
import type { EntryEditorProps } from "../../entries/index.ts";
import { useAutoSave } from "../../entries/index.ts";
import { useThemeMode } from "../../theme/index.ts";

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

  const { handleChange, isPending, isOwnOrOlder } = useAutoSave(entry.id, onSave, {
    beforeFlush: () => (runPreSave(editor) ? editor : null),
  });

  // The blocks array the editor currently reflects. Starts at the mounted
  // content so mounting never triggers a replace (and a spurious re-save).
  const appliedBlocksRef = useRef(entry.blocks);
  const applyingExternalRef = useRef(false);

  // Apply external content updates (sync pull, import) without re-mounting.
  // Keyed on the blocks reference, not updatedAt: metadata-only changes (tags,
  // pin, signifier) keep the reference and must not replace content, while a
  // refresh that delivers newer stored blocks under an unchanged updatedAt
  // must still be applied.
  useEffect(() => {
    const incoming = entry.blocks;
    if (incoming === appliedBlocksRef.current || isOwnOrOlder(incoming, entry.updatedAt)) return;
    // Unsaved local typing wins; its save is about to write a newer version.
    if (isPending()) return;
    appliedBlocksRef.current = incoming;
    if (JSON.stringify(incoming) === JSON.stringify(editor.document)) return;
    applyingExternalRef.current = true;
    try {
      editor.replaceBlocks(editor.document, incoming as never);
    } catch {
      // ignore if editor isn't ready
    } finally {
      applyingExternalRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.blocks]);

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
  // We use the `input` event (not keydown) because mobile keyboards don't fire
  // reliable keydown events for special characters like [.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const handleInput = (e: Event) => {
      const inputEvent = e as InputEvent;
      // Only care about text insertion containing [
      if (inputEvent.data && !inputEvent.data.includes("[")) return;

      // Defer check until after ProseMirror's transaction cycle completes
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

    wrapper.addEventListener("input", handleInput);
    return () => {
      wrapper.removeEventListener("input", handleInput);
      if (pendingTimer) clearTimeout(pendingTimer);
    };
  }, [editor]);

  const onChange = useCallback(() => {
    // replaceBlocks fires onChange synchronously; saving it would echo pulled
    // content back to sync with a fresh timestamp.
    if (applyingExternalRef.current) return;
    handleChange(editor);
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
