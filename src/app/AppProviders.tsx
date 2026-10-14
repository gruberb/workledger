import { MantineProvider } from "@mantine/core";
import { type ReactNode, useCallback, useMemo } from "react";
import { useTheme, ThemeContext } from "../features/theme/index.ts";
import { EntriesProvider } from "../features/entries/index.ts";
import { SidebarProvider, useSidebarUI } from "../features/sidebar/index.ts";
import { FocusModeProvider } from "../features/focus-mode/index.ts";
import { AIProvider } from "../features/ai/index.ts";
import { SyncProvider } from "../features/sync/index.ts";

function AIProviderWithSidebar({ children }: { children: ReactNode }) {
  const { setSidebarOpen } = useSidebarUI();
  const onCollapseSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  return (
    <AIProvider onCollapseSidebar={onCollapseSidebar}>
      {children}
    </AIProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const { themeId, isDark, fontFamily, setTheme, setFont } = useTheme();

  const contextValue = useMemo(
    () => ({ isDark, themeId, fontFamily, setTheme, setFont }),
    [isDark, themeId, fontFamily, setTheme, setFont],
  );

  return (
    <MantineProvider forceColorScheme={isDark ? "dark" : "light"} theme={{ fontFamily: "var(--font-sans)" }}>
      <ThemeContext.Provider value={contextValue}>
        <EntriesProvider>
          <SyncProvider>
            <SidebarProvider>
              <FocusModeProvider>
                <AIProviderWithSidebar>
                  {children}
                </AIProviderWithSidebar>
              </FocusModeProvider>
            </SidebarProvider>
          </SyncProvider>
        </EntriesProvider>
      </ThemeContext.Provider>
    </MantineProvider>
  );
}
