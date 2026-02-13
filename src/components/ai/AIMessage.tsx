import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIMessage as AIMessageType } from "../../types/ai.ts";

interface AIMessageProps {
  message: AIMessageType;
  stepName?: string;
}

export function AIMessage({ message, stepName }: AIMessageProps) {
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
            ? "bg-orange-50 text-gray-800 rounded-br-md"
            : "bg-white border border-gray-100 shadow-sm text-gray-700 rounded-bl-md"
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
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-100/50">
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
}

interface StreamingMessageProps {
  content: string;
  stepName?: string;
}

export function StreamingMessage({ content, stepName }: StreamingMessageProps) {
  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md px-4 py-3 bg-white border border-gray-100 shadow-sm text-gray-700">
        {stepName && (
          <div className="text-[10px] uppercase tracking-wider text-orange-500 font-medium mb-1.5">
            {stepName}
          </div>
        )}
        <div className="ai-markdown text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
          <span className="ai-streaming-cursor" />
        </div>
      </div>
    </div>
  );
}
