import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { AIAction } from "../actions/types.ts";
import { useAIContext } from "../context/AIContext.tsx";
import { useAIConversation } from "../hooks/useAIConversation.ts";
import { useMultiEntryContext } from "../hooks/useMultiEntryContext.ts";
import { useIsMobile } from "../../../hooks/useIsMobile.ts";
import { renderUserPrompt } from "../prompt-builder.ts";
import { conversationKey } from "../utils/conversation-key.ts";
import { ActionSelector } from "./ActionSelector.tsx";
import { AIConversation } from "./AIConversation.tsx";
import { AISetupGuide } from "./AISetupGuide.tsx";
import { AISettingsPanel } from "./AISettingsPanel.tsx";

type SidebarMode = "setup" | "actions" | "topic-prompt" | "conversation" | "settings";

export function AISidebar() {
  const isMobile = useIsMobile();
  const {
    settings,
    updateSettings: onUpdateSettings,
    available,
    provider,
    status,
    configError,
    sidebarOpen: isOpen,
    targetEntry,
    handleToggleAISidebar: onClose,
  } = useAIContext();
  const {
    conversation,
    streaming,
    streamContent,
    error,
    loadConversation,
    startConversation,
    sendMessage,
    abort,
    clearConversation,
  } = useAIConversation(settings);
  const { gatherContext } = useMultiEntryContext();

  const [userMode, setUserMode] = useState<SidebarMode>("actions");
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [topicQuery, setTopicQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  // Bumped on every new request and on Back, so an action whose context is
  // still loading can tell it was superseded and must not start a stream.
  const requestRef = useRef(0);

  // An entry-scoped conversation belongs to the entry it was started for;
  // once the user targets another entry it must not be shown or keep streaming.
  const targetEntryId = targetEntry?.id;
  const isStaleEntryConversation =
    activeAction?.scope === "entry" && conversation !== null && conversation.entryId !== (targetEntryId ?? "global");

  useEffect(() => {
    if (isStaleEntryConversation) abort();
  }, [isStaleEntryConversation, abort]);

  // Derive effective mode from connection status + user selection
  const mode = useMemo(() => {
    if (isStaleEntryConversation && userMode === "conversation") return available ? "actions" : "setup";
    if (!settings.enabled) return userMode;
    if (!available && userMode !== "settings" && userMode !== "conversation") return "setup";
    if (available && userMode === "setup") return "actions";
    return userMode;
  }, [settings.enabled, available, userMode, isStaleEntryConversation]);

  const resetToActions = useCallback(() => {
    requestRef.current++;
    clearConversation();
    setActiveAction(null);
    setTopicQuery("");
    setActiveQuery(undefined);
    setUserMode("actions");
  }, [clearConversation]);

  const executeAction = useCallback(
    async (action: AIAction, query?: string, replaceId?: string) => {
      const request = ++requestRef.current;
      const key = conversationKey(action.scope, { entryId: targetEntry?.id, query });

      if (!replaceId) {
        const existing = await loadConversation(key, action.id);
        if (request !== requestRef.current) return;
        if (existing) {
          setUserMode("conversation");
          return;
        }
      }

      const noteContent = await gatherContext(action.scope, targetEntry, query);
      if (request !== requestRef.current) return;
      const conv = startConversation(key, action.id, replaceId);
      setUserMode("conversation");
      sendMessage(conv, action, renderUserPrompt(action.userPromptTemplate, noteContent));
    },
    [targetEntry, loadConversation, startConversation, sendMessage, gatherContext],
  );

  const handleSelectAction = useCallback(
    (action: AIAction) => {
      setActiveAction(action);
      setActiveQuery(undefined);

      if (action.scope === "topic") {
        setTopicQuery("");
        setUserMode("topic-prompt");
        return;
      }

      executeAction(action);
    },
    [executeAction],
  );

  const handleTopicSubmit = useCallback(() => {
    if (!activeAction || !topicQuery.trim()) return;
    setActiveQuery(topicQuery.trim());
    executeAction(activeAction, topicQuery.trim());
  }, [activeAction, topicQuery, executeAction]);

  const handleSendFollowUp = useCallback(
    (message: string) => {
      if (!conversation || !activeAction) return;
      // The first message in the history already carries the note context.
      sendMessage(conversation, activeAction, message);
    },
    [conversation, activeAction, sendMessage],
  );

  const handleRegenerate = useCallback(() => {
    if (!conversation || !activeAction) return;
    executeAction(activeAction, activeQuery, conversation.id);
  }, [conversation, activeAction, activeQuery, executeAction]);

  const handleBack = useCallback(() => {
    if (mode === "conversation" || mode === "topic-prompt") {
      resetToActions();
    } else if (mode === "settings") {
      setUserMode(available ? "actions" : "setup");
    }
  }, [mode, available, resetToActions]);

  // Hide AI sidebar entirely on mobile
  if (isMobile) return null;

  return (
    <>
      {/* Toggle button — only visible when sidebar is closed and AI is enabled */}
      {!isOpen && settings.enabled && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Open AI sidebar (⌘⇧I)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
            <line x1="9" y1="22" x2="15" y2="22" />
          </svg>
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          ai-sidebar fixed top-0 right-0 h-full z-40
          bg-[var(--color-notebook-surface-alt)] border-l border-gray-100 dark:border-gray-800
          shadow-[-1px_0_12px_rgba(0,0,0,0.03)] dark:shadow-[-1px_0_12px_rgba(0,0,0,0.3)]
          transition-transform duration-300 ease-in-out
          w-96 flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={mode === "actions" || mode === "setup" ? onClose : handleBack}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title={mode === "actions" || mode === "setup" ? "Close sidebar" : "Back"}
          >
            {mode === "actions" || mode === "setup" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
              {mode === "setup" && "AI Setup"}
              {mode === "actions" && "AI Notebook Companion"}
              {mode === "topic-prompt" && activeAction?.name}
              {mode === "conversation" && activeAction?.name}
              {mode === "settings" && "AI Settings"}
            </h2>
            {mode === "conversation" && activeAction && (
              <p className="text-[10px] text-gray-400 truncate">
                {activeAction.description}
              </p>
            )}
          </div>

          {mode !== "settings" && mode !== "setup" && (
            <button
              onClick={() => setUserMode("settings")}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              title="AI Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0">
          {mode === "setup" && (
            <AISetupGuide
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}

          {mode === "actions" && (
            <ActionSelector
              onSelectAction={handleSelectAction}
              hasTargetEntry={!!targetEntry}
            />
          )}

          {mode === "topic-prompt" && activeAction && (
            <div className="flex flex-col items-center px-6 pt-16">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                {activeAction.name}
              </h3>
              <p className="text-xs text-gray-400 text-center mb-4">
                {activeAction.description}
              </p>
              <input
                type="text"
                value={topicQuery}
                onChange={(e) => setTopicQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleTopicSubmit(); }}
                placeholder="Enter a topic to search..."
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 dark:focus:ring-orange-900 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 placeholder:text-gray-400"
                autoFocus
              />
              <button
                onClick={handleTopicSubmit}
                disabled={!topicQuery.trim()}
                className="mt-3 w-full py-2 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-400 disabled:opacity-40 transition-colors"
              >
                Search & Analyze
              </button>
            </div>
          )}

          {mode === "conversation" && conversation && activeAction && (
            <AIConversation
              conversation={conversation}
              streaming={streaming}
              streamContent={streamContent}
              stepName={activeAction.name}
              followUpSuggestions={activeAction.followUpSuggestions}
              onSendMessage={handleSendFollowUp}
              onAbort={abort}
              onRegenerate={handleRegenerate}
              error={error}
            />
          )}

          {mode === "settings" && (
            <AISettingsPanel
              settings={settings}
              onUpdateSettings={onUpdateSettings}
              status={status}
              configError={configError}
              provider={provider}
            />
          )}
        </div>
      </aside>
    </>
  );
}
