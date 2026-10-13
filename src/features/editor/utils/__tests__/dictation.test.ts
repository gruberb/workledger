import { describe, it, expect, vi, afterEach } from "vitest";
import { getRecognitionFactory, startDictation, type RecognitionLike } from "../dictation.ts";

class FakeRecognition implements RecognitionLike {
  continuous = false;
  interimResults = true;
  lang = "";
  onresult: RecognitionLike["onresult"] = null;
  onerror: RecognitionLike["onerror"] = null;
  onend: RecognitionLike["onend"] = null;
  started = 0;
  stopped = false;
  start() { this.started++; }
  stop() { this.stopped = true; this.onend?.(); }
  say(...phrases: { text: string; final?: boolean }[]) {
    const results = phrases.map((p) => Object.assign([{ transcript: p.text }], { isFinal: p.final ?? true }));
    this.onresult?.({ resultIndex: 0, results });
  }
}

function setup(options: { maxQuickRestarts?: number; quickRestartMs?: number } = {}) {
  const recognizers: FakeRecognition[] = [];
  const texts: string[] = [];
  const ends: (string | undefined)[] = [];
  const session = startDictation({
    factory: () => { const r = new FakeRecognition(); recognizers.push(r); return r; },
    lang: "en-US",
    onText: (t) => texts.push(t),
    onEnd: (reason) => ends.push(reason),
    ...options,
  });
  return { session, recognizers, texts, ends };
}

afterEach(() => vi.useRealTimers());

describe("startDictation", () => {
  it("configures a continuous, final-only recognizer in the given language", () => {
    const { recognizers } = setup();
    expect(recognizers[0]).toMatchObject({ continuous: true, interimResults: false, lang: "en-US", started: 1 });
  });

  it("reports finished, trimmed phrases only", () => {
    const { recognizers, texts } = setup();
    recognizers[0].say({ text: "  hello world " }, { text: "still talking", final: false }, { text: "   " });
    expect(texts).toEqual(["hello world"]);
  });

  it("restarts after the browser ends a long session", () => {
    vi.useFakeTimers();
    const { recognizers, ends } = setup();
    vi.advanceTimersByTime(5000);
    recognizers[0].onend?.();
    expect(recognizers).toHaveLength(2);
    expect(recognizers[1].started).toBe(1);
    expect(ends).toEqual([]);
  });

  it("stops for good when the user stops, without restarting", () => {
    const { session, recognizers, ends } = setup();
    session.stop();
    expect(recognizers[0].stopped).toBe(true);
    expect(recognizers).toHaveLength(1);
    expect(ends).toEqual([undefined]);
    session.stop();
    expect(ends).toHaveLength(1);
  });

  it("ends with the error when permission is denied", () => {
    const { recognizers, ends } = setup();
    recognizers[0].onerror?.({ error: "not-allowed" });
    recognizers[0].onend?.();
    expect(recognizers).toHaveLength(1);
    expect(ends).toEqual(["not-allowed"]);
  });

  it("keeps listening through routine errors like no-speech", () => {
    vi.useFakeTimers();
    const { recognizers, ends } = setup();
    vi.advanceTimersByTime(5000);
    recognizers[0].onerror?.({ error: "no-speech" });
    recognizers[0].onend?.();
    expect(recognizers).toHaveLength(2);
    expect(ends).toEqual([]);
  });

  it("gives up when the recognizer keeps ending right away", () => {
    vi.useFakeTimers();
    const { recognizers, ends } = setup({ maxQuickRestarts: 3, quickRestartMs: 1000 });
    for (let i = 0; i < 3; i++) recognizers[i].onend?.();
    expect(recognizers).toHaveLength(3);
    expect(ends).toEqual(["stalled"]);
  });

  it("ends with 'stalled' when the recognizer cannot start", () => {
    const ends: (string | undefined)[] = [];
    startDictation({
      factory: () => { throw new Error("busy"); },
      lang: "en-US",
      onText: () => {},
      onEnd: (r) => ends.push(r),
    });
    expect(ends).toEqual(["stalled"]);
  });

  it("allows one session at a time: a new one ends the previous", () => {
    const first = setup();
    const second = setup();
    expect(first.ends).toEqual([undefined]);
    expect(second.ends).toEqual([]);
    second.session.stop();
  });
});

describe("getRecognitionFactory", () => {
  it("prefers the standard constructor and falls back to the webkit one", () => {
    class Standard extends FakeRecognition {}
    class Webkit extends FakeRecognition {}
    expect(getRecognitionFactory({ SpeechRecognition: Standard, webkitSpeechRecognition: Webkit })!()).toBeInstanceOf(Standard);
    expect(getRecognitionFactory({ webkitSpeechRecognition: Webkit })!()).toBeInstanceOf(Webkit);
  });

  it("returns null where there is no speech recognition", () => {
    expect(getRecognitionFactory({})).toBeNull();
  });
});
