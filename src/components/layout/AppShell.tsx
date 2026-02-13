import { type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile.ts";

interface AppShellProps {
  sidebarOpen: boolean;
  aiSidebarOpen?: boolean;
  children: ReactNode;
}

export function AppShell({ sidebarOpen, aiSidebarOpen, children }: AppShellProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className={`
        min-h-screen bg-[var(--color-notebook-bg)] text-[var(--color-notebook-text)]
        transition-[padding] duration-300 ease-in-out
        ${!isMobile && sidebarOpen ? "pl-80" : "pl-0"}
        ${!isMobile && aiSidebarOpen ? "pr-96" : "pr-0"}
      `}
    >
      <main className={`max-w-7xl mx-auto pt-6 pb-8 ${isMobile ? "px-4" : "px-12"}`}>
        {children}
      </main>
    </div>
  );
}
