import { type CSSProperties, type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile.ts";

interface AppShellProps {
  sidebarOpen: boolean;
  aiSidebarOpen?: boolean;
  /** Sticky bar above the content. Without one, sticky section headers stick to the very top. */
  header?: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebarOpen, aiSidebarOpen, header, children }: AppShellProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={`
        min-h-screen bg-[var(--color-notebook-bg)] text-[var(--color-notebook-text)]
        transition-[padding] duration-300 ease-in-out
        ${!isMobile && sidebarOpen ? "pl-[var(--sidebar-w)]" : "pl-0"}
        ${!isMobile && aiSidebarOpen ? "pr-[var(--ai-sidebar-w)]" : "pr-0"}
      `}
      // Sticky section headers sit below the header (see --app-header-h in app.css).
      style={header ? undefined : ({ "--app-header-h": "0px" } as CSSProperties)}
    >
      {header}
      <main className={`w-full mx-auto pb-28 relative ${isMobile ? "px-4" : "px-12"}`}>
        {children}
      </main>
    </div>
  );
}
