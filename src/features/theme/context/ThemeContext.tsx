import { createContext, useContext } from "react";

type ThemeMode = "light" | "dark";

export const ThemeContext = createContext<ThemeMode>("light");

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext);
}
