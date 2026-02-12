import { type ReactNode } from "react";

interface AppShellProps {
  sidebarOpen: boolean;
  children: ReactNode;
}

export function AppShell({ sidebarOpen, children }: AppShellProps) {
  return (
    <div
      className={`
        min-h-screen bg-[#fafafa] text-[#1a1a1a]
        transition-[padding] duration-300 ease-in-out
        ${sidebarOpen ? "pl-64" : "pl-0"}
      `}
    >
      <main className="max-w-7xl mx-auto px-12 pt-6 pb-8">
        {children}
      </main>
    </div>
  );
}
