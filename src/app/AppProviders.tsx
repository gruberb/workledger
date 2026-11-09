import { MantineProvider } from "@mantine/core";
import { type ReactNode, useCallback, useMemo } from "react";
import { useTheme, ThemeContext } from "../features/theme/index.ts";
import { EntriesProvider } from "../features/entries/index.ts";
import { SidebarProvider, useSidebarUI } from "../features/sidebar/index.ts";
import { FocusModeProvider } from "../features/focus-mode/index.ts";
import { AIProvider } from "../features/ai/index.ts";
import { SyncProvider } from "../features/sync/index.ts";
import { useAINoteActions } from "./hooks/useAINoteActions.ts";

function AIProviderWithSidebar({ children }: { children: ReactNode }) {
  const { setSidebarOpen } = useSidebarUI();
  const onCollapseSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const noteActions = useAINoteActions();

  return (
    <AIProvider onCollapseSidebar={onCollapseSidebar} noteActions={noteActions}>
      {children}
    </AIProvider>
  );
}

// Menus open and close instantly. Their 150ms fade never showed (app.css forces
// dropdowns opaque so BlockNote's stay readable), so a closing menu just stayed
// on screen for 150ms and felt laggy.
const NO_TRANSITION = { transitionProps: { duration: 0 } };
const MANTINE_THEME = {
  fontFamily: "var(--font-sans)",
  components: { Menu: { defaultProps: NO_TRANSITION }, Popover: { defaultProps: NO_TRANSITION } },
};

export function AppProviders({ children }: { children: ReactNode }) {
  const { themeId, isDark, fontFamily, setTheme, setFont } = useTheme();

  const contextValue = useMemo(
    () => ({ isDark, themeId, fontFamily, setTheme, setFont }),
    [isDark, themeId, fontFamily, setTheme, setFont],
  );

  return (
    <MantineProvider forceColorScheme={isDark ? "dark" : "light"} theme={MANTINE_THEME}>
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
