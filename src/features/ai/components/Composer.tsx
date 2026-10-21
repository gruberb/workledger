import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import type { AIImage } from "../providers/types.ts";
import { imageDataUrl, readImageFile } from "../utils/images.ts";
import { CloseIcon, FileIcon } from "../../../components/ui/Icons.tsx";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { ContextChip } from "./ContextChip.tsx";
import { NotePicker, type AttachedNote } from "./NotePicker.tsx";

const MAX_TEXTAREA_PX = 200;

interface ComposerProps {
  streaming: boolean;
  placeholder: string;
  onSend: (text: string, images: AIImage[]) => void;
  onStop: () => void;
  /** Notes sent along with the next message. */
  notes: AttachedNote[];
  onToggleNote: (note: AttachedNote) => void;
  /** Prompt the next message runs with. */
  pendingPrompt?: string;
  onClearPrompt?: () => void;
  promptsOpen: boolean;
  /** Omitted where the prompts are already on screen. */
  onTogglePrompts?: () => void;
  maxImages?: number;
  /** Send works with an empty message (a prompt that runs on attached notes). */
  canSendEmpty?: boolean;
  /** Why send is unavailable, shown under the box (e.g. a note prompt with no note). */
  blockedReason?: string;
}

/** Message box: text, pasted or dropped images, attached notes and the prompt picker. */
export function Composer({
  streaming, placeholder, onSend, onStop, notes, onToggleNote, pendingPrompt, onClearPrompt, promptsOpen, onTogglePrompts, maxImages = 4, canSendEmpty = false, blockedReason,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<AIImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  // The whole composer counts as inside, so its own toggle button doesn't close and reopen the picker.
  useClickOutside(rootRef, closePicker, pickerOpen);

  const canSend = !streaming && !blockedReason && (canSendEmpty || text.trim().length > 0 || images.length > 0);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  };

  const addFiles = async (files: File[]) => {
    const picked = files.filter((f) => f.type.startsWith("image/"));
    if (picked.length === 0) return;
    setImageError(null);
    const room = maxImages - images.length;
    if (picked.length > room) setImageError(`Up to ${maxImages} images per message`);
    const results = await Promise.allSettled(picked.slice(0, Math.max(0, room)).map((f) => readImageFile(f)));
    const read = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (results.some((r) => r.status === "rejected")) setImageError("Some images could not be read");
    setImages((prev) => [...prev, ...read].slice(0, maxImages));
  };

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim(), images);
    setText("");
    setImages([]);
    setImageError(null);
    requestAnimationFrame(resize);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing: Enter confirms an IME candidate (Japanese, Chinese) and must not send.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void addFiles([...e.dataTransfer.files]);
  };

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 border-t border-[var(--color-notebook-border)] px-3 pt-2 pb-3 ${dragging ? "bg-[var(--color-notebook-surface)]" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {pickerOpen && (
        <NotePicker
          selectedIds={notes.map((n) => n.id)}
          onToggle={onToggleNote}
          onClose={() => { closePicker(); textareaRef.current?.focus(); }}
        />
      )}

      {(notes.length > 0 || pendingPrompt) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingPrompt && onClearPrompt && (
            <ContextChip label={pendingPrompt} tone="accent" onRemove={onClearPrompt} removeLabel={`Don't use the ${pendingPrompt} prompt`} />
          )}
          {notes.map((note) => (
            <ContextChip
              key={note.id}
              label={note.title}
              icon={<FileIcon size={11} className="shrink-0 text-[var(--color-notebook-muted)]" />}
              onRemove={() => onToggleNote(note)}
              removeLabel={`Remove note ${note.title}`}
            />
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((image, i) => (
            <span key={i} className="relative">
              <img src={imageDataUrl(image)} alt={`Attachment ${i + 1}`} className="h-14 w-14 object-cover rounded-md border border-[var(--color-notebook-border)]" />
              <button
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-[var(--color-notebook-text)] text-[var(--color-notebook-bg)]"
                aria-label={`Remove attachment ${i + 1}`}
              >
                <CloseIcon size={10} strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      )}
      {blockedReason && <p className="text-[11px] text-[var(--color-notebook-muted)] mb-2">{blockedReason}</p>}
      {imageError && <p role="alert" className="text-[11px] text-[var(--color-notebook-muted)] mb-2">{imageError}</p>}

      <div className="rounded-xl border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] focus-within:border-[var(--color-notebook-accent)] focus-within:ring-1 focus-within:ring-[var(--color-notebook-accent)] transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => { setText(e.target.value); resize(); }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={2}
          aria-label="Message"
          className="ai-composer-input block w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)]"
        />
        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="p-1.5 rounded-md text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors"
            title="Attach images (or paste and drop them)"
            aria-label="Attach images"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-xs transition-colors ${pickerOpen ? "bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-accent)]" : "text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)]"}`}
            title="Attach notes as context"
            aria-expanded={pickerOpen}
          >
            <FileIcon size={14} />
            Notes{notes.length > 0 && ` (${notes.length})`}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ""; }}
          />
          {onTogglePrompts && (
            <button
              onClick={onTogglePrompts}
              className={`px-2 py-1 rounded-md text-xs transition-colors ${promptsOpen ? "bg-[var(--color-notebook-surface-alt)] text-[var(--color-notebook-accent)]" : "text-[var(--color-notebook-muted)] hover:text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)]"}`}
              aria-expanded={promptsOpen}
            >
              Prompts
            </button>
          )}
          <div className="flex-1" />
          {streaming ? (
            <button
              onClick={onStop}
              className="px-2.5 py-1 rounded-md text-xs text-[var(--color-notebook-text)] bg-[var(--color-notebook-surface-alt)] hover:opacity-80"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-1.5 rounded-md notebook-primary disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Send"
              title="Send (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
