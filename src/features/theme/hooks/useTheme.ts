import { useState, useEffect, useCallback } from "react";
import { getDB } from "../../../storage/db.ts";
import { THEME_PRESETS, FONT_OPTIONS, migrateThemeValue, type ThemeId, type FontFamily } from "../themePresets.ts";
import { useFontLoader } from "./useFontLoader.ts";

const LS_THEME_KEY = "workledger-theme";
const LS_FONT_KEY = "workledger-font";
const DB_THEME_KEY = "theme";
const DB_FONT_KEY = "font";

const VALID_FONT_IDS = new Set<string>(FONT_OPTIONS.map((f) => f.id));

function getSystemThemeId(): ThemeId {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "ink"
    : "paper";
}

function applyThemeToDOM(themeId: ThemeId) {
  const preset = THEME_PRESETS.find((p) => p.id === themeId);
  if (!preset) return;

  document.documentElement.dataset.theme = themeId;

  if (preset.isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function applyFontToDOM(fontFamily: FontFamily) {
  const option = FONT_OPTIONS.find((f) => f.id === fontFamily);
  if (!option) return;
  document.documentElement.style.setProperty("--editor-body-font", option.cssValue);
}

export function useTheme() {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(LS_THEME_KEY);
    if (stored) {
      const migrated = migrateThemeValue(stored);
      if (migrated) return migrated;
    }
    return getSystemThemeId();
  });

  const [fontFamily, setFontFamilyState] = useState<FontFamily>(() => {
    const stored = localStorage.getItem(LS_FONT_KEY);
    if (stored && VALID_FONT_IDS.has(stored)) return stored as FontFamily;
    return "figtree";
  });

  const [hasExplicitTheme, setHasExplicitTheme] = useState(() => {
    const stored = localStorage.getItem(LS_THEME_KEY);
    return stored !== null && migrateThemeValue(stored) !== null;
  });

  // Load from IndexedDB on mount (source of truth)
  useEffect(() => {
    getDB().then(async (db) => {
      const themeRow = await db.get("settings", DB_THEME_KEY);
      if (themeRow) {
        const migrated = migrateThemeValue(themeRow.value as string);
        if (migrated) {
          setThemeIdState(migrated);
          setHasExplicitTheme(true);
          applyThemeToDOM(migrated);
          localStorage.setItem(LS_THEME_KEY, migrated);
        }
      }

      const fontRow = await db.get("settings", DB_FONT_KEY);
      if (fontRow && VALID_FONT_IDS.has(fontRow.value as string)) {
        const f = fontRow.value as FontFamily;
        setFontFamilyState(f);
        applyFontToDOM(f);
        localStorage.setItem(LS_FONT_KEY, f);
      }
    });
  }, []);

  // Apply theme to DOM whenever themeId changes
  useEffect(() => {
    applyThemeToDOM(themeId);
  }, [themeId]);

  // Apply font to DOM whenever fontFamily changes
  useEffect(() => {
    applyFontToDOM(fontFamily);
  }, [fontFamily]);

  // Load font files dynamically
  useFontLoader(fontFamily);

  // Listen for system preference changes when no explicit choice
  useEffect(() => {
    if (hasExplicitTheme) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const id = e.matches ? "ink" : "paper";
      setThemeIdState(id);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [hasExplicitTheme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    setHasExplicitTheme(true);
    localStorage.setItem(LS_THEME_KEY, id);
    applyThemeToDOM(id);
    getDB().then((db) => db.put("settings", { key: DB_THEME_KEY, value: id }));
  }, []);

  const setFont = useCallback((f: FontFamily) => {
    setFontFamilyState(f);
    localStorage.setItem(LS_FONT_KEY, f);
    applyFontToDOM(f);
    getDB().then((db) => db.put("settings", { key: DB_FONT_KEY, value: f }));
  }, []);

  const isDark = THEME_PRESETS.find((p) => p.id === themeId)?.isDark ?? false;

  return { themeId, setTheme, isDark, fontFamily, setFont } as const;
}
