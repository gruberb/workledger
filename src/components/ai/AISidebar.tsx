import { useState, useEffect, useCallback } from "react";
import type { AISettings } from "../../types/ai.ts";
import type { WorkLedgerEntry } from "../../types/entry.ts";
import type { ThinkingFramework, FrameworkStep } from "../../ai/frameworks/types.ts";
import { extractTextFromBlocks } from "../../storage/search-index.ts";
import { useAIConversation } from "../../hooks/useAIConversation.ts";
import { useAIFeatureGate } from "../../hooks/useAIFeatureGate.ts";
import { FrameworkSelector } from "./FrameworkSelector.tsx";
import { AIConversation } from "./AIConversation.tsx";
import { AISetupGuide } from "./AISetupGuide.tsx";
import { AISettingsPanel } from "./AISettingsPanel.tsx";
import type { Block } from "@blocknote/core";

type SidebarMode = "setup" | "frameworks" | "conversation" | "settings";

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onUpdateSettings: (updates: Partial<AISettings>) => Promise<void>;
  targetEntry: WorkLedgerEntry | null;
}

export function AISidebar({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  targetEntry,
}: AISidebarProps) {
  const { available } = useAIFeatureGate(settings);
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

  const [mode, setMode] = useState<SidebarMode>("frameworks");
  const [activeFramework, setActiveFramework] = useState<ThinkingFramework | null>(null);
  const [activeStep, setActiveStep] = useState<FrameworkStep | null>(null);

  // Determine initial mode based on connection status
  useEffect(() => {
    if (!settings.enabled) return;
    if (!available && mode !== "settings") {
      Promise.resolve().then(() => setMode("setup"));
    } else if (available && mode === "setup") {
      Promise.resolve().then(() => setMode("frameworks"));
    }
  }, [available, settings.enabled, mode]);

  // Reset when target entry changes
  useEffect(() => {
    if (targetEntry && activeFramework) {
      loadConversation(targetEntry.id, activeFramework.id);
    }
  }, [targetEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectFramework = useCallback(
    (framework: ThinkingFramework) => {
      setActiveFramework(framework);
      const firstStep = framework.steps[0];
      setActiveStep(firstStep);

      if (!targetEntry) return;

      // Try loading existing conversation
      loadConversation(targetEntry.id, framework.id).then((existing) => {
        if (!existing) {
          // Start new conversation and immediately send the first message
          const conv = startConversation(targetEntry.id, framework.id, firstStep.id);
          const noteText = extractTextFromBlocks(targetEntry.blocks as Block[]);
          sendMessage(conv, firstStep, noteText);
        }
        setMode("conversation");
      });
    },
    [targetEntry, loadConversation, startConversation, sendMessage],
  );

  const handleSendFollowUp = useCallback(
    (message: string) => {
      if (!conversation || !activeStep || !targetEntry) return;
      const noteText = extractTextFromBlocks(targetEntry.blocks as Block[]);
      sendMessage(conversation, activeStep, noteText, message);
    },
    [conversation, activeStep, targetEntry, sendMessage],
  );

  const handleSwitchStep = useCallback(
    (step: FrameworkStep) => {
      setActiveStep(step);
      if (!conversation || !targetEntry) return;
      // Start fresh with the new step
      const conv = startConversation(targetEntry.id, conversation.frameworkId, step.id);
      const noteText = extractTextFromBlocks(targetEntry.blocks as Block[]);
      sendMessage(conv, step, noteText);
      setMode("conversation");
    },
    [conversation, targetEntry, startConversation, sendMessage],
  );

  const handleBack = useCallback(() => {
    if (mode === "conversation") {
      clearConversation();
      setActiveFramework(null);
      setActiveStep(null);
      setMode("frameworks");
    } else if (mode === "settings") {
      setMode(available ? "frameworks" : "setup");
    }
  }, [mode, available, clearConversation]);

  return (
    <>
      {/* Toggle button — only visible when sidebar is closed and AI is enabled */}
      {!isOpen && settings.enabled && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 p-2 rounded-lg hover:bg-gray-100 transition-all duration-300 text-gray-400 hover:text-gray-600"
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
          bg-[#fcfcfc] border-l border-gray-100
          shadow-[-1px_0_12px_rgba(0,0,0,0.03)]
          transition-transform duration-300 ease-in-out
          w-96 flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <button
            onClick={mode === "frameworks" || mode === "setup" ? onClose : handleBack}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title={mode === "frameworks" || mode === "setup" ? "Close sidebar" : "Back"}
          >
            {mode === "frameworks" || mode === "setup" ? (
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
            <h2 className="text-sm font-medium text-gray-700 truncate">
              {mode === "setup" && "AI Setup"}
              {mode === "frameworks" && "Think with AI"}
              {mode === "conversation" && activeFramework?.name}
              {mode === "settings" && "AI Settings"}
            </h2>
            {mode === "conversation" && targetEntry && (
              <p className="text-[10px] text-gray-400 truncate">
                {extractTextFromBlocks(targetEntry.blocks as Block[]).slice(0, 60)}
              </p>
            )}
          </div>

          {/* Step tabs for conversation mode */}
          {mode !== "settings" && mode !== "setup" && (
            <button
              onClick={() => setMode("settings")}
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

        {/* Step navigation tabs (conversation mode) */}
        {mode === "conversation" && activeFramework && (
          <div className="shrink-0 flex overflow-x-auto border-b border-gray-100 px-2 gap-1 py-2">
            {activeFramework.steps.map((step) => (
              <button
                key={step.id}
                onClick={() => handleSwitchStep(step)}
                className={`
                  text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors shrink-0
                  ${activeStep?.id === step.id
                    ? "bg-orange-100 text-orange-700 font-medium"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                {step.name}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 min-h-0">
          {mode === "setup" && (
            <AISetupGuide
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}

          {mode === "frameworks" && !targetEntry && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="text-4xl mb-4 text-gray-200">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-300">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
                  <line x1="9" y1="22" x2="15" y2="22" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Select a note first</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Hover over a note and click the
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block mx-1 -mt-0.5 text-orange-400">
                  <path d="M12 2a8 8 0 0 0-8 8c0 3.36 2.07 6.24 5 7.42V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.58c2.93-1.18 5-4.06 5-7.42a8 8 0 0 0-8-8z" />
                  <line x1="9" y1="22" x2="15" y2="22" />
                </svg>
                icon to start thinking with AI about that note's content.
              </p>
            </div>
          )}

          {mode === "frameworks" && targetEntry && (
            <FrameworkSelector onSelectFramework={handleSelectFramework} />
          )}

          {mode === "conversation" && conversation && activeStep && (
            <AIConversation
              conversation={conversation}
              streaming={streaming}
              streamContent={streamContent}
              currentStep={activeStep}
              followUpSuggestions={activeStep.followUpSuggestions}
              onSendMessage={handleSendFollowUp}
              onAbort={abort}
              error={error}
            />
          )}

          {mode === "settings" && (
            <AISettingsPanel
              settings={settings}
              onUpdateSettings={onUpdateSettings}
            />
          )}
        </div>
      </aside>
    </>
  );
}
