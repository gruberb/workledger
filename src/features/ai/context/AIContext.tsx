import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAISettings } from "../hooks/useAISettings.ts";
import { useAIFeatureGate } from "../hooks/useAIFeatureGate.ts";
import type { AISettings } from "../types/ai.ts";
import type { WorkLedgerEntry } from "../../entries/types/entry.ts";

interface AIContextValue {
  settings: AISettings;
  updateSettings: (updates: Partial<AISettings>) => Promise<void>;
  available: boolean;
  sidebarOpen: boolean;
  targetEntry: WorkLedgerEntry | null;
  handleToggleAI: () => void;
  handleOpenAI: (entry: WorkLedgerEntry) => void;
  handleToggleAISidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const AICtx = createContext<AIContextValue | null>(null);

export function AIProvider({ children, onCollapseSidebar }: { children: ReactNode; onCollapseSidebar?: () => void }) {
  const { settings, updateSettings } = useAISettings();
  const { available } = useAIFeatureGate(settings);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [targetEntry, setTargetEntry] = useState<WorkLedgerEntry | null>(null);

  // Auto-collapse left sidebar when AI sidebar opens on narrow screens
  useEffect(() => {
    if (!sidebarOpen) return;
    const check = () => {
      if (window.innerWidth < 1200) {
        onCollapseSidebar?.();
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [sidebarOpen, onCollapseSidebar]);

  const handleToggleAI = useCallback(() => {
    const newEnabled = !settings.enabled;
    updateSettings({ enabled: newEnabled });
    if (!newEnabled) {
      setSidebarOpen(false);
    }
  }, [settings.enabled, updateSettings]);

  const handleOpenAI = useCallback((entry: WorkLedgerEntry) => {
    setTargetEntry(entry);
    setSidebarOpen(true);
  }, []);

  const handleToggleAISidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const value: AIContextValue = {
    settings,
    updateSettings,
    available,
    sidebarOpen,
    targetEntry,
    handleToggleAI,
    handleOpenAI,
    handleToggleAISidebar,
    setSidebarOpen,
  };

  return <AICtx.Provider value={value}>{children}</AICtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAIContext(): AIContextValue {
  const ctx = useContext(AICtx);
  if (!ctx) throw new Error("useAIContext must be used within AIProvider");
  return ctx;
}
