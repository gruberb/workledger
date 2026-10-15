// The PDF renderer prints garbage, not a fallback glyph, for characters its font
// lacks. Text is fitted to the font first: common symbols get ASCII stand-ins
// and anything else becomes "?".

// Windows-1252 characters outside Latin-1; with Latin-1 they are all the
// standard PDF fonts (Courier) can print.
const CP1252_EXTRAS = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

const REPLACEMENTS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "⇒": "=>",
  "⇐": "<=",
  "↑": "^",
  "↓": "v",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "≈": "~",
  "✓": "v",
  "✔": "v",
  "✗": "x",
  "✘": "x",
  "−": "-",
  "‐": "-",
  "‑": "-",
  "′": "'",
  "″": '"',
  " ": " ",
  " ": " ",
  "​": "",
  "️": "",
};

export type HasGlyph = (codePoint: number) => boolean;

export const isWinAnsi: HasGlyph = (code) =>
  (code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRAS.has(String.fromCodePoint(code));

export function fitToFont(text: string, hasGlyph: HasGlyph): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x0a || code === 0x09 || hasGlyph(code)) {
      out += ch;
      continue;
    }
    const stand = REPLACEMENTS[ch];
    out += stand !== undefined && [...stand].every((c) => hasGlyph(c.codePointAt(0) ?? 0)) ? stand : "?";
  }
  return out;
}
