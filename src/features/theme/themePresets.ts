export type ThemeId =
  | "nord-light"
  | "nord-dark"
  | "punktespiegel"
  | "high-contrast"
  | "high-contrast-light"
  | "dracula"
  | "catppuccin-mocha"
  | "solarized-light";

export type FontFamily = "figtree" | "plus-jakarta-sans" | "dm-sans" | "urbanist" | "inter" | "monospace" | "serif";

export interface ThemePreset {
  id: ThemeId;
  label: string;
  isDark: boolean;
  accentColor: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "nord-light", label: "Nord Aurora", isDark: false, accentColor: "#4a6b95" },
  { id: "nord-dark", label: "Nord Polar Night", isDark: true, accentColor: "#88c0d0" },
  { id: "punktespiegel", label: "Punktespiegel", isDark: false, accentColor: "#206080" },
  { id: "high-contrast", label: "High Contrast Dark", isDark: true, accentColor: "#ffd60a" },
  { id: "high-contrast-light", label: "High Contrast Light", isDark: false, accentColor: "#0033cc" },
  { id: "dracula", label: "Dracula", isDark: true, accentColor: "#bd93f9" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", isDark: true, accentColor: "#f5a97f" },
  { id: "solarized-light", label: "Solarized Light", isDark: false, accentColor: "#859900" },
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
