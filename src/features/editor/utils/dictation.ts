// Speech to text through the browser's Web Speech API (SpeechRecognition).
// Where the audio is processed is up to the browser: Chrome sends it to a web
// service (MDN: "won't work offline"), so the menu item warns about that. Nothing
// here uploads anything itself. Support varies: Chrome 33+ (prefixed) and 139+,
// Safari 14.1+ (prefixed), Firefox in preview builds only. Both constructor names
// are tried, so a browser that ships it later works without a change.

interface RecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

export interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export type RecognitionFactory = () => RecognitionLike;

/** The browser's recognizer, or null where there is none (e.g. Firefox release builds). */
export function getRecognitionFactory(scope: object = window): RecognitionFactory | null {
  const w = scope as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? () => new Ctor() : null;
}

/** Errors after which restarting would only fail again (permission, hardware, service). */
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

export interface DictationOptions {
  factory: RecognitionFactory;
  /** BCP 47 tag, e.g. "en-US". */
  lang: string;
  /** A finished phrase, already trimmed and never empty. */
  onText: (text: string) => void;
  /** The session is over: `reason` is the recognizer's error, "stalled", or undefined for a normal stop. */
  onEnd: (reason?: string) => void;
  /**
   * Browsers end a continuous session after a pause, so it is restarted. This many
   * restarts in a row that end within `quickRestartMs` mean the recognizer is not working.
   */
  maxQuickRestarts?: number;
  quickRestartMs?: number;
}

export interface Dictation {
  stop(): void;
}

let active: Dictation | null = null;

/** Starts listening. Only one session runs at a time: a new one ends the previous. */
export function startDictation({ factory, lang, onText, onEnd, maxQuickRestarts = 3, quickRestartMs = 1000 }: DictationOptions): Dictation {
  active?.stop();

  let wanted = true;
  let finished = false;
  let fatal: string | undefined;
  let quickRestarts = 0;
  let current: RecognitionLike | null = null;

  const finish = (reason?: string) => {
    if (finished) return;
    finished = true;
    if (active === session) active = null;
    onEnd(reason);
  };

  const begin = () => {
    const startedAt = Date.now();
    const rec = factory();
    current = rec;
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = lang;
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const text = result[0].transcript.trim();
        if (text) onText(text);
      }
    };
    rec.onerror = (event) => {
      // "no-speech" and "aborted" are routine; the end handler restarts or finishes.
      if (FATAL_ERRORS.has(event.error)) {
        fatal = event.error;
        wanted = false;
      }
    };
    rec.onend = () => {
      if (!wanted) return finish(fatal);
      quickRestarts = Date.now() - startedAt < quickRestartMs ? quickRestarts + 1 : 0;
      if (quickRestarts >= maxQuickRestarts) {
        wanted = false;
        return finish("stalled");
      }
      try {
        begin();
      } catch {
        wanted = false;
        finish("stalled");
      }
    };
    rec.start();
  };

  const session: Dictation = {
    stop() {
      if (finished) return;
      wanted = false;
      // onend finishes the session; a recognizer that never started has no onend.
      if (current) current.stop();
      else finish();
    },
  };
  active = session;

  try {
    begin();
  } catch {
    wanted = false;
    finish("stalled");
  }
  return session;
}
