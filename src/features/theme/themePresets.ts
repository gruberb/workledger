export type ThemeId =
  | "paper"
  | "ink"
  | "nord-light"
  | "nord-dark"
  | "high-contrast"
  | "high-contrast-light";

export type FontFamily = "figtree" | "plus-jakarta-sans" | "dm-sans" | "urbanist" | "inter" | "monospace" | "serif";

export interface ThemePreset {
  id: ThemeId;
  label: string;
  isDark: boolean;
  accentColor: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "paper", label: "Paper", isDark: false, accentColor: "#3046c5" },
  { id: "ink", label: "Ink", isDark: true, accentColor: "#aab8ff" },
  { id: "nord-light", label: "Nord Aurora", isDark: false, accentColor: "#4a6b95" },
  { id: "nord-dark", label: "Nord Polar Night", isDark: true, accentColor: "#88c0d0" },
  { id: "high-contrast", label: "High Contrast Dark", isDark: true, accentColor: "#ffd60a" },
  { id: "high-contrast-light", label: "High Contrast Light", isDark: false, accentColor: "#0033cc" },
];

export interface FontOption {
  id: FontFamily;
  label: string;
  cssValue: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "figtree", label: "Figtree", cssValue: "'Figtree', system-ui, sans-serif" },
  { id: "plus-jakarta-sans", label: "Plus Jakarta Sans", cssValue: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "dm-sans", label: "DM Sans", cssValue: "'DM Sans', system-ui, sans-serif" },
  { id: "urbanist", label: "Urbanist", cssValue: "'Urbanist', system-ui, sans-serif" },
  { id: "inter", label: "Inter", cssValue: "'Inter', system-ui, sans-serif" },
  { id: "monospace", label: "JetBrains Mono", cssValue: "'JetBrains Mono', monospace" },
  { id: "serif", label: "Source Serif 4", cssValue: "'Source Serif 4', Georgia, serif" },
];

/** Preserve saved preferences when older theme names are retired. */
export function migrateThemeValue(value: string): ThemeId | null {
  if (value === "dark" || value === "default-dark") return "nord-dark";
  if (value === "light" || value === "default-light") return "nord-light";
  if (value === "solarized-light" || value === "punktespiegel") return "paper";
  if (value === "catppuccin-mocha" || value === "dracula") return "ink";
  return THEME_PRESETS.find((preset) => preset.id === value)?.id ?? null;
}
