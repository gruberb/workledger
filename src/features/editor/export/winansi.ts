// The standard PDF fonts (Helvetica, Courier) only cover Windows-1252. Other
// characters would print as garbage, so common symbols get ASCII stand-ins and
// the rest become "?". Embedding a font with wider coverage would add hundreds
// of KB to every export.

// Windows-1252 characters outside Latin-1.
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

export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x0a || code === 0x09 || (code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRAS.has(ch)) out += ch;
    else out += REPLACEMENTS[ch] ?? "?";
  }
  return out;
}
