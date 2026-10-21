import { memo, useDeferredValue, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIMessage as AIMessageType } from "../types/ai.ts";
import type { AISource } from "../providers/types.ts";
import { imageDataUrl } from "../utils/images.ts";

const REMARK_PLUGINS = [remarkGfm];

interface AIMessageProps {
  message: AIMessageType;
  stepName?: string;
  /** Appends the reply to the thread's note. Omitted when the thread has none. */
  onAddToNote?: (markdown: string) => Promise<void>;
  onNewEntry?: (markdown: string) => Promise<void>;
}

type WriteStatus = { label: string; state: "busy" | "done" | "failed" } | null;

// Saved messages never change, so memo keeps streaming updates from
// re-parsing the markdown of every earlier message.
export const AIMessage = memo(function AIMessage({ message, stepName, onAddToNote, onNewEntry }: AIMessageProps) {
  const [copied, setCopied] = useState(false);
  const [writeStatus, setWriteStatus] = useState<WriteStatus>(null);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the text is still selectable.
    }
  };

  const write = async (label: string, task: (markdown: string) => Promise<void>) => {
    setWriteStatus({ label, state: "busy" });
    try {
      await task(message.content);
      setWriteStatus({ label, state: "done" });
    } catch (err) {
      console.warn("[ai] Could not write the reply into a note:", err);
      setWriteStatus({ label, state: "failed" });
    }
  };

  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const images = message.images && message.images.length > 0 && (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {message.images.map((image, i) => (
        <img key={i} src={imageDataUrl(image)} alt={`Attachment ${i + 1}`} className="max-h-32 max-w-full rounded-md border border-[var(--color-notebook-border)]" />
      ))}
    </div>
  );

  if (isUser) {
    return (
      <div className="flex justify-end mb-5">
        <div className="max-w-[88%] rounded-2xl rounded-br-md px-3.5 py-2.5 bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] text-[var(--color-notebook-text)]">
          {images}
          <p className="text-sm whitespace-pre-wrap">{message.display ?? message.content}</p>
          {message.display !== undefined && (
            <details className="mt-1.5 text-[11px] text-[var(--color-notebook-muted)]">
              <summary className="cursor-pointer select-none">Sent with your notes</summary>
              <p className="mt-1.5 max-h-60 overflow-y-auto whitespace-pre-wrap">{message.content}</p>
            </details>
          )}
        </div>
      </div>
    );
  }

  // Replies run full width, like a document: they are read and copied into notes.
  return (
    <div className="mb-5 text-[var(--color-notebook-text)]">
      {stepName && (
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-notebook-accent)] font-medium mb-1.5">
          {stepName}
        </div>
      )}
      <div className="ai-markdown text-sm">
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
          {message.content}
        </ReactMarkdown>
      </div>
      {message.sources && message.sources.length > 0 && <SourceList sources={message.sources} />}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 mt-1.5 text-[11px] text-[var(--color-notebook-muted)]">
        {onAddToNote && (
          <MessageAction onClick={() => write("Added to note", onAddToNote)} disabled={writeStatus?.state === "busy"} title="Append this reply to the end of the note">
            Add to note
          </MessageAction>
        )}
        {onNewEntry && (
          <MessageAction onClick={() => write("Created entry", onNewEntry)} disabled={writeStatus?.state === "busy"} title="Create a new entry from this reply">
            New entry
          </MessageAction>
        )}
        <MessageAction onClick={handleCopy}>{copied ? "Copied" : "Copy"}</MessageAction>
        {writeStatus && (
          <span role="status" className="px-1.5 whitespace-nowrap">
            {writeStatus.state === "busy" ? "Writing…" : writeStatus.state === "done" ? `✓ ${writeStatus.label}` : "Could not write the note"}
          </span>
        )}
        <span className="ml-auto pl-2 text-[10px] tabular-nums">{time}</span>
      </div>
    </div>
  );
});

interface MessageActionProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function MessageAction({ onClick, disabled, title, children }: MessageActionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-1.5 py-0.5 rounded whitespace-nowrap hover:text-[var(--color-notebook-accent)] hover:bg-[var(--color-notebook-surface)] transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

interface SourceListProps {
  sources: AISource[];
}

function SourceList({ sources }: SourceListProps) {
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-notebook-muted)] font-medium mb-1">Sources</div>
      <ol className="text-xs space-y-0.5 list-decimal list-inside text-[var(--color-notebook-muted)]">
        {sources.map((source) => (
          <li key={source.url} className="truncate">
            {/* URLs are http(s)-only (toSource); noopener keeps the page from reaching back into the app. */}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-notebook-accent)] hover:underline" title={source.url}>
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
    <div className="mb-5 text-[var(--color-notebook-text)]">
      <div>
        {stepName && (
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-notebook-accent)] font-medium mb-1.5">
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
