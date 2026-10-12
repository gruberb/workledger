import { memo, useDeferredValue, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIMessage as AIMessageType } from "../types/ai.ts";
import type { AISource } from "../providers/types.ts";

const REMARK_PLUGINS = [remarkGfm];

interface AIMessageProps {
  message: AIMessageType;
  stepName?: string;
}

// Saved messages never change, so memo keeps streaming updates from
// re-parsing the markdown of every earlier message.
export const AIMessage = memo(function AIMessage({ message, stepName }: AIMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`
          max-w-[90%] rounded-2xl px-4 py-3
          ${isUser
            ? "bg-orange-50 dark:bg-orange-950/30 text-gray-800 dark:text-gray-200 rounded-br-md"
            : "bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-300 rounded-bl-md"
          }
        `}
      >
        {!isUser && stepName && (
          <div className="text-[10px] uppercase tracking-wider text-orange-500 font-medium mb-1.5">
            {stepName}
          </div>
        )}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="ai-markdown text-sm">
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-100/50 dark:border-gray-700/50">
          <span className="text-[10px] text-gray-300">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && (
            <button
              onClick={handleCopy}
              className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

interface SourceListProps {
  sources: AISource[];
}

function SourceList({ sources }: SourceListProps) {
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Sources</div>
      <ol className="text-xs space-y-0.5 list-decimal list-inside text-gray-500">
        {sources.map((source) => (
          <li key={source.url} className="truncate">
            {/* URLs are http(s)-only (toSource); noopener keeps the page from reaching back into the app. */}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 dark:text-orange-400 hover:underline" title={source.url}>
              {source.title ?? new URL(source.url).hostname}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

interface StreamingMessageProps {
  content: string;
  stepName?: string;
}

export function StreamingMessage({ content, stepName }: StreamingMessageProps) {
  // Re-parsing the whole markdown per token is quadratic; deferring lets React
  // drop intermediate chunks when parsing can't keep up.
  const deferredContent = useDeferredValue(content);
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md px-4 py-3 bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-300">
        {stepName && (
          <div className="text-[10px] uppercase tracking-wider text-orange-500 font-medium mb-1.5">
            {stepName}
          </div>
        )}
        <div className="ai-markdown text-sm">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
            {deferredContent}
          </ReactMarkdown>
          <span className="ai-streaming-cursor" />
        </div>
      </div>
    </div>
  );
}
