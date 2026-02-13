import { useRef, useEffect, useState } from "react";
import type { AIConversation as AIConversationType } from "../../types/ai.ts";
import type { FrameworkStep } from "../../ai/frameworks/types.ts";
import { AIMessage, StreamingMessage } from "./AIMessage.tsx";

interface AIConversationProps {
  conversation: AIConversationType;
  streaming: boolean;
  streamContent: string;
  currentStep: FrameworkStep;
  followUpSuggestions: string[];
  onSendMessage: (message: string) => void;
  onAbort: () => void;
  error: string | null;
}

export function AIConversation({
  conversation,
  streaming,
  streamContent,
  currentStep,
  followUpSuggestions,
  onSendMessage,
  onAbort,
  error,
}: AIConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation.messages, streamContent]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {conversation.messages.map((msg) => (
          <AIMessage
            key={msg.id}
            message={msg}
            stepName={msg.role === "assistant" ? currentStep.name : undefined}
          />
        ))}

        {streaming && streamContent && (
          <StreamingMessage content={streamContent} stepName={currentStep.name} />
        )}

        {streaming && !streamContent && (
          <div className="flex justify-start mb-4">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="ai-thinking-dots">Thinking</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-2 mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Follow-up suggestions */}
        {!streaming && conversation.messages.length > 0 && followUpSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 mt-2">
            {followUpSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSendMessage(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3">
        {streaming ? (
          <button
            onClick={onAbort}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 rounded-lg transition-colors"
          >
            Stop generating
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up..."
              rows={1}
              className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-100 bg-white text-gray-700 placeholder:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
