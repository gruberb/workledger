import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { CloseIcon, PlusIcon, SettingsIcon, ArrowLeftIcon } from "../../../components/ui/Icons.tsx";
import { extractTitle, getEntry, type WorkLedgerEntry } from "../../entries/index.ts";
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
  entry?: WorkLedgerEntry | null;
  /** Overwrite this saved thread instead of starting a new one (Regenerate). */
  replaceId?: string;
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
    targetEntry,
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
  /** Target entry when the current thread was shown; null for none. */
  const [shownWith, setShownWith] = useState<string | null>(null);
  /** The user removed this entry from the context of the next thread. */
  const [detachedFor, setDetachedFor] = useState<string | null>(null);
  // Bumped on every new request and on New thread, so an action whose context is
  // still loading can tell it was superseded and must not start a stream.
  const requestRef = useRef(0);

  const targetEntryId = targetEntry?.id ?? null;
  // "Think with AI" on another entry starts a fresh thread there; a thread
  // belongs to the target it was shown with. Derived instead of reset in an
  // effect, so a thread opened from the recent list survives until then.
  const visibleConversation = conversation && shownWith === targetEntryId ? conversation : null;
  const noteForNewThread = targetEntry && detachedFor !== targetEntry.id ? targetEntry : null;

  useEffect(() => {
    if (conversation && !visibleConversation) abort();
  }, [conversation, visibleConversation, abort]);

  const allActions = useMemo(() => [...customPrompts.map(customPromptToAction), ...AI_ACTIONS], [customPrompts]);
  const findAction = useCallback((id: string) => allActions.find((a) => a.id === id) ?? CHAT_ACTION, [allActions]);

  const showThread = useCallback((action: AIAction) => {
    setActiveAction(action);
    setPendingAction(null);
    setPromptsOpen(false);
    setShownWith(targetEntryId);
    setView("chat");
  }, [targetEntryId]);

  const runAction = useCallback(async (action: AIAction, { query, images, entry = null, replaceId }: RunOptions) => {
    const request = ++requestRef.current;
    const key = conversationKey(action.scope, { entryId: entry?.id, query });

    // Prompts on a note, day or week resume their saved thread; Regenerate starts over.
    if (!replaceId && action.scope !== "ask") {
      const existing = await loadConversation(key, action.id);
      if (request !== requestRef.current) return;
      if (existing) {
        showThread(action);
        return;
      }
    }

    const noteContent = await gatherContext(action.scope, entry, query);
    if (request !== requestRef.current) return;
    const conv = startConversation(key, action.id, {
      title: makeThreadTitle(action, { query, entryTitle: entry ? extractTitle(entry) : undefined }),
      targetEntryId: entry?.id,
      query: action.scope === "topic" ? query : undefined,
    }, replaceId);
    showThread(action);
    // The bubble shows what the user typed or picked; the notes stay folded behind it.
    const display = action.scope === "ask" ? query : action.scope === "topic" ? `${action.name}: ${query}` : action.name;
    sendMessage(conv, action, renderUserPrompt(action.userPromptTemplate, noteContent), images, display);
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
    if (action.scope === "topic" || action.scope === "ask") {
      // Runs on the next message, in a new thread.
      requestRef.current++;
      clearConversation();
      setPendingAction(action);
      return;
    }
    void runAction(action, { entry: noteForNewThread });
  }, [clearConversation, runAction, noteForNewThread]);

  const handleSend = useCallback((text: string, images: AIImage[]) => {
    const message = text || IMAGE_ONLY_TEXT;
    if (pendingAction) {
      void runAction(pendingAction, { query: message, images, entry: pendingAction.scope === "ask" ? noteForNewThread : null });
    } else if (visibleConversation) {
      sendMessage(visibleConversation, activeAction, message, images);
    } else {
      void runAction(CHAT_ACTION, { query: message, images, entry: noteForNewThread });
    }
  }, [pendingAction, visibleConversation, activeAction, noteForNewThread, runAction, sendMessage]);

  const handleRegenerate = useCallback(async () => {
    if (!visibleConversation) return;
    const entry = visibleConversation.targetEntryId ? await getEntry(visibleConversation.targetEntryId) : null;
    void runAction(activeAction, { query: visibleConversation.query, entry: entry ?? null, replaceId: visibleConversation.id });
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
  const pendingPlaceholder = pendingAction?.scope === "topic" ? "Enter a topic to search your notes…" : pendingAction ? `Your message for ${pendingAction.name}…` : null;

  let title: string;
  if (showSetup) title = "AI Setup";
  else if (view === "settings") title = "AI Settings";
  else if (view === "prompt-editor") title = editingPromptId ? "Edit prompt" : "New prompt";
  else title = visibleConversation?.title ?? (visibleConversation ? activeAction.name : "New thread");

  const subtitle = view === "chat" && visibleConversation && activeAction.id !== CHAT_ACTION.id ? activeAction.name : null;

  const gallery = (
    <PromptGallery
      actions={allActions}
      hasEntry={!!noteForNewThread}
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
        <button onClick={onClose} className={headerButton} title="Close AI sidebar (⌘⇧I)" aria-label="Close AI sidebar">
          <CloseIcon size={16} />
        </button>
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
                {!targetEntry && " To work on a note, use \"Think with AI\" on it."}
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
          attachedNote={!visibleConversation && noteForNewThread && pendingAction?.scope !== "topic" ? extractTitle(noteForNewThread) : undefined}
          onDetachNote={() => setDetachedFor(targetEntryId)}
          detachedNote={!visibleConversation && targetEntry && !noteForNewThread ? extractTitle(targetEntry) : undefined}
          onAttachNote={() => setDetachedFor(null)}
          pendingPrompt={pendingAction?.name}
          onClearPrompt={() => setPendingAction(null)}
          promptsOpen={promptsOpen}
          onTogglePrompts={visibleConversation ? () => setPromptsOpen((o) => !o) : undefined}
        />
      )}
    </aside>
  );
}
