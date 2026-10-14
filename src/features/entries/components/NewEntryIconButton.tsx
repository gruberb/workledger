import { useState, useRef, useCallback } from "react";
import type { EntryTemplate } from "../utils/templates.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { PlusIcon } from "../../../components/ui/Icons.tsx";
import { TemplateMenu } from "./TemplateMenu.tsx";

interface NewEntryIconButtonProps {
  onClick: () => void;
  onCreateFromTemplate: (template: EntryTemplate) => void;
}

/** Compact "+" for the header. A tap opens the menu, blank entry first, so templates are never hidden behind a gesture. */
export function NewEntryIconButton({ onClick, onCreateFromTemplate }: NewEntryIconButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(wrapperRef, closeMenu, menuOpen);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setMenuOpen((open) => !open)}
        className="min-w-9 h-9 rounded-md notebook-primary flex items-center justify-center shadow-sm transition-colors"
        title="New entry"
        aria-label="New entry"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <PlusIcon size={18} strokeWidth={2.5} />
      </button>
      {menuOpen && (
        <TemplateMenu
          className="absolute top-full right-0 mt-2 z-50"
          onBlank={() => { setMenuOpen(false); onClick(); }}
          onSelect={(template) => { setMenuOpen(false); onCreateFromTemplate(template); }}
        />
      )}
    </div>
  );
}
