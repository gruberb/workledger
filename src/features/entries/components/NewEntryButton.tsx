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
      className={`fixed bottom-8 z-[999] ${aiSidebarOpen ? "right-[26rem]" : "right-8"}`}
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
          rounded-full
          shadow-lg shadow-orange-500/20 dark:shadow-orange-500/30
          hover:shadow-xl hover:shadow-orange-500/25 dark:hover:shadow-orange-500/35
          transition-shadow duration-300 ease-in-out
        "
      >
        {/* Main button */}
        <button
          onClick={onClick}
          className="
            flex items-center gap-2
            bg-orange-500 hover:bg-orange-400 active:bg-orange-600
            text-white font-medium
            px-6 py-3.5 rounded-l-full
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
        <div className="w-px bg-orange-400/40 self-stretch" />

        {/* Template dropdown toggle */}
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="
            flex items-center
            bg-orange-500 hover:bg-orange-400 active:bg-orange-600
            text-white
            px-2.5 rounded-r-full
            transition-colors duration-200
          "
          title="New from template"
          aria-label="New from template"
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
