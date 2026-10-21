import { useRef, useEffect } from "react";
import type { AIConversation as AIConversationType } from "../types/ai.ts";
import { AIMessage, StreamingMessage } from "./AIMessage.tsx";

interface AIConversationProps {
  conversation: AIConversationType;
  streaming: boolean;
  streamContent: string;
  /** Label above replies; omitted for plain chat. */
  stepName?: string;
  followUpSuggestions: string[];
  onSendMessage: (message: string) => void;
  /** Re-runs the prompt on the latest notes. Omitted for chat threads, which have nothing to re-read. */
  onRegenerate?: () => void;
  onAddToNote?: (markdown: string) => Promise<void>;
  onNewEntry?: (markdown: string) => Promise<void>;
  error: string | null;
}


/** The messages of one thread. The composer below it belongs to the sidebar. */
export function AIConversation({
  conversation,
  streaming,
  streamContent,
  stepName,
  followUpSuggestions,
  onSendMessage,
  onRegenerate,
  onAddToNote,
  onNewEntry,
  error,
}: AIConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.messages, streamContent]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-4">
      {conversation.messages.map((msg) => (
        <AIMessage
          key={msg.id}
          message={msg}
          stepName={msg.role === "assistant" ? stepName : undefined}
          onAddToNote={msg.role === "assistant" ? onAddToNote : undefined}
          onNewEntry={msg.role === "assistant" ? onNewEntry : undefined}
        />
      ))}

      {streaming && streamContent && (
        <StreamingMessage content={streamContent} stepName={stepName} />
      )}

      {streaming && !streamContent && (
        <div className="mb-5">
          <span className="ai-thinking-dots text-sm text-[var(--color-notebook-muted)]">Thinking</span>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!streaming && conversation.messages.length > 0 && (onRegenerate || followUpSuggestions.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs px-2.5 py-1.5 rounded-full border border-[var(--color-notebook-border)] text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] transition-colors"
              title="Start over with the latest notes"
            >
              Regenerate
            </button>
          )}
          {followUpSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSendMessage(suggestion)}
              className="text-xs px-2.5 py-1.5 rounded-full border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-accent)] hover:border-[var(--color-notebook-accent)] transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
