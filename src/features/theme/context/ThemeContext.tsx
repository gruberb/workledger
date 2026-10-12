import { createContext, useContext } from "react";
import type { ThemeId, FontFamily } from "../themePresets.ts";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  isDark: boolean;
  themeId: ThemeId;
  fontFamily: FontFamily;
  setTheme: (id: ThemeId) => void;
  setFont: (f: FontFamily) => void;
}

const noop = () => {};

export const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  themeId: "nord-light",
  fontFamily: "figtree",
  setTheme: noop,
  setFont: noop,
});

/** Returns "light" | "dark" — backward-compatible for EntryEditor / Excalidraw */
export function useThemeMode(): ThemeMode {
  const { isDark } = useContext(ThemeContext);
  return isDark ? "dark" : "light";
}

/** Returns the full theme context including setters */
export function useThemeContext() {
  return useContext(ThemeContext);
}
