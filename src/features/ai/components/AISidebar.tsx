import { useState, useCallback, useMemo, useRef } from "react";
import type { AIAction } from "../actions/types.ts";
import type { AIConversation as AIConversationType } from "../types/ai.ts";
import type { AIImage } from "../providers/types.ts";
import { AI_ACTIONS, CHAT_ACTION, customPromptToAction } from "../actions/actions.ts";
import { useAIContext } from "../context/AIContext.tsx";
import { useAIConversation } from "../hooks/useAIConversation.ts";
import { useCustomPrompts } from "../hooks/useCustomPrompts.ts";
import { useMultiEntryContext } from "../hooks/useMultiEntryContext.ts";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { useResizablePanel } from "../../../hooks/useResizablePanel.ts";
import { ResizeHandle } from "../../../components/ui/ResizeHandle.tsx";
import { PlusIcon, SettingsIcon, ArrowLeftIcon } from "../../../components/ui/Icons.tsx";
import type { AttachedNote } from "./NotePicker.tsx";
import { renderUserPrompt } from "../prompt-builder.ts";
import { conversationKey } from "../utils/conversation-key.ts";
import { makeThreadTitle } from "../utils/thread-title.ts";
import { AIConversation } from "./AIConversation.tsx";
import { AISetupGuide } from "./AISetupGuide.tsx";
import { AISettingsPanel } from "./AISettingsPanel.tsx";
import { Composer } from "./Composer.tsx";
import { PromptEditor } from "./PromptEditor.tsx";
import { PromptGallery } from "./PromptGallery.tsx";
import { ThreadMenu } from "./ThreadMenu.tsx";

const WIDTH_LIMITS = { min: 320, max: 720, collapseBelow: 240 };

// Some providers reject an empty text part next to an image.
const IMAGE_ONLY_TEXT = "(See the attached image.)";

type View = "chat" | "settings" | "prompt-editor";

interface RunOptions {
  query?: string;
  images?: AIImage[];
  notes?: AttachedNote[];
  /** Overwrite this saved thread instead of starting a new one (Regenerate). */
  replaceId?: string;
  /** Keeps the title of the thread being regenerated. */
  title?: string;
}

const headerButton = "p-1.5 rounded-md text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface)] transition-colors shrink-0";

export function AISidebar() {
  const isMobile = useIsMobile();
  const {
    settings,
    updateSettings: onUpdateSettings,
    available,
    provider,
    status,
    configError,
    recheckConnection,
    sidebarOpen: isOpen,
    handleToggleAISidebar: onClose,
    noteActions,
  } = useAIContext();
  const {
    conversation,
    streaming,
    streamContent,
    error,
    loadConversation,
    openConversation,
    startConversation,
    sendMessage,
    abort,
    clearConversation,
  } = useAIConversation(settings);
  const { gatherContext } = useMultiEntryContext();
  const { prompts: customPrompts, savePrompt, deletePrompt } = useCustomPrompts();
  const resize = useResizablePanel({
    cssVar: "--ai-sidebar-w",
    storageKey: "workledger-ai-sidebar-width",
    defaultWidth: 384,
    side: "right",
    ...WIDTH_LIMITS,
    onCollapse: onClose,
  });

  const [view, setView] = useState<View>("chat");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction>(CHAT_ACTION);
  /** A prompt that runs on the next message (topic and message-scoped prompts). */
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  /** Notes that go along with the next message. */
  const [notes, setNotes] = useState<AttachedNote[]>([]);
  // Bumped on every new request and on New thread, so an action whose context is
  // still loading can tell it was superseded and must not start a stream.
  const requestRef = useRef(0);

  const visibleConversation = conversation;

  const handleToggleNote = useCallback((note: AttachedNote) => {
    setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev.filter((n) => n.id !== note.id) : [...prev, note]));
  }, []);

  const allActions = useMemo(() => [...customPrompts.map(customPromptToAction), ...AI_ACTIONS], [customPrompts]);
  const findAction = useCallback((id: string) => allActions.find((a) => a.id === id) ?? CHAT_ACTION, [allActions]);

  const showThread = useCallback((action: AIAction) => {
    setActiveAction(action);
    setPendingAction(null);
    setPromptsOpen(false);
    setView("chat");
  }, []);

  const runAction = useCallback(async (action: AIAction, { query, images, notes: withNotes = [], replaceId, title }: RunOptions) => {
    const request = ++requestRef.current;
    const entryIds = withNotes.map((n) => n.id);
    const key = conversationKey(action.scope, { entryIds, query });

    // Prompts on a note, day or week resume their saved thread; Regenerate and
    // extra instructions start over.
    const extraInstructions = !!query && action.scope !== "ask" && action.scope !== "topic";
    if (!replaceId && action.scope !== "ask" && !extraInstructions) {
      const existing = await loadConversation(key, action.id);
      if (request !== requestRef.current) return;
      if (existing) {
        showThread(action);
        return;
      }
    }

    const noteContent = await gatherContext(action.scope, entryIds, query);
    if (request !== requestRef.current) return;
    const entryTitle = withNotes.length > 1 ? `${withNotes[0].title} +${withNotes.length - 1}` : withNotes[0]?.title;
    const conv = startConversation(key, action.id, {
      title: title ?? makeThreadTitle(action, { query, entryTitle }),
      entryIds: entryIds.length > 0 ? entryIds : undefined,
      targetEntryId: entryIds[0],
      query: action.scope === "topic" ? query : undefined,
    }, replaceId);
    showThread(action);
    // The bubble shows what the user typed or picked; the notes stay folded behind it.
    let display = query ? `${action.name}: ${query}` : action.name;
    if (action.scope === "ask") display = query ?? "";
    const prompt = renderUserPrompt(action.userPromptTemplate, noteContent);
    // Note, day and week prompts take typed text as an extra instruction after the notes.
    const extra = query && action.scope !== "ask" && action.scope !== "topic" ? `\n\n${query}` : "";
    sendMessage(conv, action, prompt + extra, images, display);
  }, [loadConversation, gatherContext, startConversation, sendMessage, showThread]);

  const handleNewThread = useCallback(() => {
    requestRef.current++;
    clearConversation();
    setActiveAction(CHAT_ACTION);
    setPendingAction(null);
    setPromptsOpen(false);
    setView("chat");
  }, [clearConversation]);

  const handleOpenThread = useCallback((conv: AIConversationType) => {
    requestRef.current++;
    openConversation(conv);
    showThread(findAction(conv.frameworkId));
  }, [openConversation, showThread, findAction]);

  const handleThreadDeleted = useCallback((id: string) => {
    if (conversation?.id === id) handleNewThread();
  }, [conversation, handleNewThread]);

  const handleSelectPrompt = useCallback((action: AIAction) => {
    setPromptsOpen(false);
    // Topic and message prompts wait for the next message; note prompts wait for notes.
    if (action.scope === "topic" || action.scope === "ask" || (action.scope === "entry" && notes.length === 0)) {
      requestRef.current++;
      clearConversation();
      setPendingAction(action);
      return;
    }
    void runAction(action, { notes });
    setNotes([]);
  }, [clearConversation, runAction, notes]);

  const handleSend = useCallback(async (text: string, images: AIImage[]) => {
    const message = text || IMAGE_ONLY_TEXT;
    const withNotes = notes;
    setNotes([]);
    if (pendingAction?.scope === "entry") {
      // Typed text goes along as extra instructions for the prompt.
      void runAction(pendingAction, { query: text || undefined, images, notes: withNotes });
    } else if (pendingAction) {
      void runAction(pendingAction, { query: message, images, notes: pendingAction.scope === "ask" ? withNotes : [] });
    } else if (visibleConversation) {
      if (withNotes.length === 0) {
        sendMessage(visibleConversation, activeAction, message, images);
        return;
      }
      // Notes attached mid-thread go along with this message only.
      const request = ++requestRef.current;
      const content = await gatherContext("ask", withNotes.map((n) => n.id), message);
      if (request !== requestRef.current) return;
      const conv = visibleConversation.targetEntryId ? visibleConversation : { ...visibleConversation, targetEntryId: withNotes[0].id };
      sendMessage(conv, activeAction, content, images, message);
    } else {
      void runAction(CHAT_ACTION, { query: message, images, notes: withNotes });
    }
  }, [notes, pendingAction, visibleConversation, activeAction, runAction, sendMessage, gatherContext]);

  const handleRegenerate = useCallback(() => {
    if (!visibleConversation) return;
    const ids = visibleConversation.entryIds ?? (visibleConversation.targetEntryId ? [visibleConversation.targetEntryId] : []);
    // Note titles only feed the thread title, which Regenerate keeps.
    const sameNotes = ids.map((id) => ({ id, title: "" }));
    void runAction(activeAction, { query: visibleConversation.query, notes: sameNotes, replaceId: visibleConversation.id, title: visibleConversation.title });
  }, [visibleConversation, activeAction, runAction]);

  const threadEntryId = visibleConversation?.targetEntryId;
  const handleAddToNote = useMemo(() => (noteActions && threadEntryId
    ? (markdown: string) => noteActions.addToEntry(threadEntryId, markdown)
    : undefined), [noteActions, threadEntryId]);

  const handleEditPrompt = useCallback((id: string) => {
    setEditingPromptId(id);
    setPromptsOpen(false);
    setView("prompt-editor");
  }, []);

  const handleNewPrompt = useCallback(() => {
    setEditingPromptId(null);
    setPromptsOpen(false);
    setView("prompt-editor");
  }, []);

  const handleDeletePrompt = useCallback(async (id: string) => {
    await deletePrompt(id);
    if (pendingAction?.id === id) setPendingAction(null);
  }, [deletePrompt, pendingAction]);

  // Hide AI sidebar entirely on mobile
  if (isMobile) return null;

  const showSetup = !available && view !== "settings";
  const isSubView = view !== "chat" && !showSetup;
  let pendingPlaceholder: string | null = null;
  if (pendingAction?.scope === "topic") pendingPlaceholder = "Enter a topic to search your notes…";
  else if (pendingAction?.scope === "entry") pendingPlaceholder = "Optional: extra instructions…";
  else if (pendingAction) pendingPlaceholder = `Your message for ${pendingAction.name}…`;
  const noteMissing = pendingAction?.scope === "entry" && notes.length === 0;

  let title: string;
  if (showSetup) title = "AI Setup";
  else if (view === "settings") title = "AI Settings";
  else if (view === "prompt-editor") title = editingPromptId ? "Edit prompt" : "New prompt";
  else title = visibleConversation?.title ?? (visibleConversation ? activeAction.name : "New thread");

  const subtitle = view === "chat" && visibleConversation && activeAction.id !== CHAT_ACTION.id ? activeAction.name : null;

  const gallery = (
    <PromptGallery
      actions={allActions}
      onSelect={handleSelectPrompt}
      onEdit={handleEditPrompt}
      onNew={handleNewPrompt}
    />
  );

  return (
    <aside
      className={`
        ai-sidebar fixed top-0 right-0 h-full z-40
        bg-[var(--color-notebook-surface-alt)] border-l border-[var(--color-notebook-border)]
        shadow-[-1px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-1px_0_12px_rgba(0,0,0,0.3)]
        transition-transform duration-300 ease-in-out
        w-[var(--ai-sidebar-w)] flex flex-col
        ${isOpen ? "translate-x-0" : "translate-x-full"}
        ${resize.collapsing ? "opacity-50" : ""}
      `}
      inert={!isOpen}
      aria-label="AI sidebar"
    >
      <ResizeHandle
        edge="left"
        label="Resize AI sidebar"
        width={resize.width}
        min={WIDTH_LIMITS.min}
        max={WIDTH_LIMITS.max}
        onPointerDown={resize.handlePointerDown}
        onKeyDown={resize.handleKeyDown}
      />

      {/* Height matches the app header so both bars line up. */}
      <div className="shrink-0 h-[var(--app-header-h)] flex items-center gap-1 pl-3 pr-2 border-b border-[var(--color-notebook-border)]">
        {isSubView && (
          <button onClick={() => setView("chat")} className={headerButton} title="Back" aria-label="Back">
            <ArrowLeftIcon size={16} />
          </button>
        )}
        <div className="flex-1 min-w-0 px-1">
          <h2 className="text-sm font-medium text-[var(--color-notebook-text)] truncate" title={title}>{title}</h2>
          {subtitle && <p className="text-[11px] text-[var(--color-notebook-muted)] truncate">{subtitle}</p>}
        </div>
        {!showSetup && view === "chat" && (
          <>
            <ThreadMenu
              currentId={visibleConversation?.id}
              fallbackTitle={(c) => findAction(c.frameworkId).name}
              onOpen={handleOpenThread}
              onDeleted={handleThreadDeleted}
            />
            <button onClick={handleNewThread} className={headerButton} title="New thread" aria-label="New thread">
              <PlusIcon size={16} />
            </button>
          </>
        )}
        {!showSetup && view !== "settings" && (
          <button onClick={() => setView("settings")} className={headerButton} title="AI settings" aria-label="AI settings">
            <SettingsIcon size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        {showSetup && (
          <AISetupGuide settings={settings} onUpdateSettings={onUpdateSettings} onConnectionSuccess={recheckConnection} />
        )}

        {view === "settings" && (
          <AISettingsPanel settings={settings} onUpdateSettings={onUpdateSettings} status={status} configError={configError} provider={provider} />
        )}

        {view === "prompt-editor" && !showSetup && (
          <PromptEditor
            key={editingPromptId ?? "new"}
            prompt={customPrompts.find((p) => p.id === editingPromptId)}
            onSave={savePrompt}
            onDelete={handleDeletePrompt}
            onDone={() => setView("chat")}
          />
        )}

        {view === "chat" && !showSetup && (
          visibleConversation ? (
            <AIConversation
              conversation={visibleConversation}
              streaming={streaming}
              streamContent={streamContent}
              stepName={activeAction.id === CHAT_ACTION.id ? undefined : activeAction.name}
              followUpSuggestions={activeAction.followUpSuggestions}
              onSendMessage={(message) => handleSend(message, [])}
              onRegenerate={activeAction.scope !== "ask" ? handleRegenerate : undefined}
              onAddToNote={handleAddToNote}
              onNewEntry={noteActions?.createEntry}
              error={error}
            />
          ) : (
            <div className="h-full overflow-y-auto px-4 py-5">
              <h3 className="text-base font-medium text-[var(--color-notebook-text)]">What are you working on?</h3>
              <p className="mt-1 mb-5 text-xs text-[var(--color-notebook-muted)]">
                Ask anything below, paste text or screenshots, or start from a prompt.
                {notes.length === 0 && " Attach notes with the Notes button below."}
              </p>
              {error && <p role="alert" className="mb-4 text-xs text-red-700 dark:text-red-300">{error}</p>}
              {gallery}
            </div>
          )
        )}

        {promptsOpen && view === "chat" && !showSetup && visibleConversation && (
          <div className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto px-4 py-4 bg-[var(--color-notebook-surface-alt)] border-t border-[var(--color-notebook-border)] shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
            <p className="mb-3 text-xs text-[var(--color-notebook-muted)]">Starts a new thread.</p>
            {gallery}
          </div>
        )}
      </div>

      {view === "chat" && !showSetup && (
        <Composer
          streaming={streaming}
          placeholder={pendingPlaceholder ?? (visibleConversation ? "Reply…" : "Ask anything, paste text or screenshots…")}
          onSend={handleSend}
          onStop={abort}
          notes={notes}
          onToggleNote={handleToggleNote}
          pendingPrompt={pendingAction?.name}
          onClearPrompt={() => setPendingAction(null)}
          promptsOpen={promptsOpen}
          onTogglePrompts={visibleConversation ? () => setPromptsOpen((o) => !o) : undefined}
          canSendEmpty={pendingAction?.scope === "entry"}
          blockedReason={noteMissing ? `${pendingAction.name} runs on notes: attach one with Notes.` : undefined}
        />
      )}
    </aside>
  );
}
