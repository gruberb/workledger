import { useState, useRef, useCallback, memo } from "react";
import type { EntryTemplate } from "../utils/templates.ts";
import { TemplateMenu } from "./TemplateMenu.tsx";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";

interface NewEntryButtonProps {
  onClick: () => void;
  onCreateFromTemplate?: (template: EntryTemplate) => void;
  aiSidebarOpen?: boolean;
}

export const NewEntryButton = memo(function NewEntryButton({ onClick, onCreateFromTemplate, aiSidebarOpen }: NewEntryButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, closeMenu, menuOpen);

  return (
    <div
      ref={menuRef}
      onKeyDown={(event) => { if (event.key === "Escape" && menuOpen) { event.stopPropagation(); closeMenu(); menuRef.current?.querySelector<HTMLButtonElement>('[aria-label="New from template"]')?.focus(); } }}
      className={`fixed bottom-8 z-[999] ${aiSidebarOpen ? "right-[calc(var(--ai-sidebar-w)+2rem)]" : "right-8"}`}
    >
      {menuOpen && (
        <TemplateMenu
          className="absolute bottom-full right-0 mb-2"
          onSelect={(template) => {
            onCreateFromTemplate?.(template);
            setMenuOpen(false);
          }}
        />
      )}

      <div
        className="
          flex items-stretch
          rounded-md shadow-sm border border-[var(--color-notebook-border)]
          transition-shadow duration-300 ease-in-out
        "
      >
        {/* Main button */}
        <button
          onClick={onClick}
          className="
            flex items-center gap-2
            notebook-primary font-medium
            px-6 py-3.5 rounded-l-md
            transition-colors duration-200
          "
          title="New Entry (⌘J)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-sm">New Entry</span>
        </button>

        {/* Divider */}
        <div className="w-px bg-[var(--color-notebook-on-accent)] opacity-25 self-stretch" />

        {/* Template dropdown toggle */}
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="
            flex items-center
            notebook-primary
            px-2.5 rounded-r-md
            transition-colors duration-200
          "
          title="New from template"
          aria-label="New from template"
          aria-expanded={menuOpen}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  );
});
