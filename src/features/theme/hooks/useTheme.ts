import { useState, useEffect, useCallback } from "react";
import { getDB } from "../../../storage/db.ts";

type ThemeMode = "light" | "dark";

const LS_KEY = "workledger-theme";
const DB_KEY = "theme";

function getSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useTheme() {
  const [resolved, setResolved] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return getSystemTheme();
  });
  const [hasExplicit, setHasExplicit] = useState(() => {
    const stored = localStorage.getItem(LS_KEY);
    return stored === "dark" || stored === "light";
  });

  // Load from IndexedDB on mount (source of truth)
  useEffect(() => {
    getDB().then(async (db) => {
      const row = await db.get("settings", DB_KEY);
      if (row && (row.value === "dark" || row.value === "light")) {
        setResolved(row.value);
        setHasExplicit(true);
        applyTheme(row.value);
        localStorage.setItem(LS_KEY, row.value);
      }
    });
  }, []);

  // Apply theme class whenever resolved changes
  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Listen for system preference changes when no explicit choice
  useEffect(() => {
    if (hasExplicit) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const mode = e.matches ? "dark" : "light";
      setResolved(mode);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [hasExplicit]);

  const toggle = useCallback(() => {
    const next: ThemeMode = resolved === "dark" ? "light" : "dark";
    setResolved(next);
    setHasExplicit(true);
    localStorage.setItem(LS_KEY, next);
    applyTheme(next);
    getDB().then((db) => db.put("settings", { key: DB_KEY, value: next }));
  }, [resolved]);

  return { resolved, toggle } as const;
}
