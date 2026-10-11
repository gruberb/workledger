import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { ErrorBoundary } from "../../../components/ui/ErrorBoundary.tsx";
import { useAISettings } from "../hooks/useAISettings.ts";
import { useAIFeatureGate, type AIConnectionStatus } from "../hooks/useAIFeatureGate.ts";
import { DEFAULT_AI_SETTINGS, type AISettings } from "../types/ai.ts";
import type { LLMProvider } from "../providers/types.ts";
import type { WorkLedgerEntry } from "../../entries/index.ts";

interface AIContextValue {
  settings: AISettings;
  updateSettings: (updates: Partial<AISettings>) => Promise<void>;
  available: boolean;
  provider: LLMProvider | null;
  status: AIConnectionStatus;
  configError: string | null;
  sidebarOpen: boolean;
  targetEntry: WorkLedgerEntry | null;
  handleToggleAI: () => void;
  handleOpenAI: (entry: WorkLedgerEntry) => void;
  handleToggleAISidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

const noop = () => {};

// Served when AIProvider is absent or crashed, so consumers degrade to "AI off"
// instead of throwing and blanking the app.
const DISABLED_AI: AIContextValue = {
  settings: DEFAULT_AI_SETTINGS,
  updateSettings: async () => {},
  available: false,
  provider: null,
  status: "disabled",
  configError: null,
  sidebarOpen: false,
  targetEntry: null,
  handleToggleAI: noop,
  handleOpenAI: noop,
  handleToggleAISidebar: noop,
  setSidebarOpen: noop,
};

const AICtx = createContext<AIContextValue>(DISABLED_AI);

// Below this width the left sidebar and the AI sidebar don't fit side by side.
const NARROW_QUERY = "(max-width: 1199px)";

interface AIProviderProps {
  children: ReactNode;
  onCollapseSidebar?: () => void;
}

export function AIProvider({ children, onCollapseSidebar }: AIProviderProps) {
  return (
    <ErrorBoundary fallback={children}>
      <AIProviderInner onCollapseSidebar={onCollapseSidebar}>{children}</AIProviderInner>
    </ErrorBoundary>
  );
}

function AIProviderInner({ children, onCollapseSidebar }: AIProviderProps) {
  const { settings, updateSettings } = useAISettings();
  const { available, provider, status, configError } = useAIFeatureGate(settings);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [targetEntry, setTargetEntry] = useState<WorkLedgerEntry | null>(null);

  // Collapse the left sidebar when the AI sidebar opens on a narrow window, or
  // when the window shrinks past the threshold. Listening for "change" rather
  // than "resize" lets users re-open the left sidebar without it snapping shut.
  useEffect(() => {
    if (!sidebarOpen) return;
    const query = window.matchMedia(NARROW_QUERY);
    if (query.matches) onCollapseSidebar?.();
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) onCollapseSidebar?.();
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
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

  const value = useMemo<AIContextValue>(() => ({
    settings,
    updateSettings,
    available,
    provider,
    status,
    configError,
    sidebarOpen,
    targetEntry,
    handleToggleAI,
    handleOpenAI,
    handleToggleAISidebar,
    setSidebarOpen,
  }), [settings, updateSettings, available, provider, status, configError, sidebarOpen, targetEntry, handleToggleAI, handleOpenAI, handleToggleAISidebar]);

  return <AICtx.Provider value={value}>{children}</AICtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAIContext(): AIContextValue {
  return useContext(AICtx);
}
