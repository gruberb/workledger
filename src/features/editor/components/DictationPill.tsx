interface DictationPillProps {
  /** Why dictation ended on its own; omitted while listening. */
  error?: string;
  onStop: () => void;
}

const MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in the browser's site settings.",
  "service-not-allowed": "This browser's speech service is not available.",
  "audio-capture": "No microphone found.",
  "language-not-supported": "Your language is not supported for dictation here.",
  stalled: "Dictation stopped working. Try again in a moment.",
};

/** Shows that the microphone is on, with a Stop button, or why dictation ended. */
export function DictationPill({ error, onStop }: DictationPillProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      // Don't take focus (or the cursor) away from the note.
      onMouseDown={(e) => e.preventDefault()}
      className="fixed left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex items-center gap-3 max-w-[calc(100vw-2rem)] rounded-full border border-[var(--color-notebook-border)] bg-[var(--color-notebook-surface)] text-[var(--color-notebook-text)] shadow-lg pl-4 pr-2 py-2 text-sm"
    >
      {error ? (
        <>
          <span>{MESSAGES[error] ?? `Dictation stopped (${error}).`}</span>
          <button onClick={onStop} className="rounded-full px-3 py-1 text-[var(--color-notebook-muted)] hover:bg-[var(--color-notebook-surface-alt)]">Dismiss</button>
        </>
      ) : (
        <>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span>Listening…</span>
          <button onClick={onStop} className="rounded-full bg-red-500 hover:bg-red-400 text-white px-3 py-1 font-medium">Stop</button>
        </>
      )}
    </div>
  );
}
