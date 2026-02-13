import { type ReactNode, useCallback } from "react";
import { useTheme } from "../features/theme/hooks/useTheme.ts";
import { ThemeContext } from "../features/theme/context/ThemeContext.tsx";
import { EntriesProvider } from "../features/entries/context/EntriesContext.tsx";
import { SidebarProvider, useSidebarContext } from "../features/sidebar/context/SidebarContext.tsx";
import { FocusModeProvider } from "../features/focus-mode/context/FocusModeContext.tsx";
import { AIProvider } from "../features/ai/context/AIContext.tsx";

function AIProviderWithSidebar({ children }: { children: ReactNode }) {
  const { setSidebarOpen } = useSidebarContext();
  const onCollapseSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  return (
    <AIProvider onCollapseSidebar={onCollapseSidebar}>
      {children}
    </AIProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const { resolved: themeMode } = useTheme();

  return (
    <ThemeContext.Provider value={themeMode}>
      <EntriesProvider>
        <SidebarProvider>
          <FocusModeProvider>
            <AIProviderWithSidebar>
              {children}
            </AIProviderWithSidebar>
          </FocusModeProvider>
        </SidebarProvider>
      </EntriesProvider>
    </ThemeContext.Provider>
  );
}
