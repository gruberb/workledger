import { useState, useRef, useCallback, memo } from "react";
import type { EntryTemplate } from "../utils/templates.ts";
import { TemplateMenu } from "./TemplateMenu.tsx";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { ChevronRightIcon, PlusIcon } from "../../../components/ui/Icons.tsx";

interface NewEntryButtonProps {
  onClick: () => void;
  onCreateFromTemplate?: (template: EntryTemplate) => void;
}

/** The header's primary action: a new blank entry, with templates behind the chevron. */
export const NewEntryButton = memo(function NewEntryButton({ onClick, onCreateFromTemplate }: NewEntryButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(menuRef, closeMenu, menuOpen);

  return (
    <div
      ref={menuRef}
      onKeyDown={(event) => { if (event.key === "Escape" && menuOpen) { event.stopPropagation(); closeMenu(); menuRef.current?.querySelector<HTMLButtonElement>('[aria-label="New from template"]')?.focus(); } }}
      className="relative shrink-0"
    >
      <div className="primary-split">
        <button onClick={onClick} className="notebook-primary pl-3 pr-3.5" title="New entry (⌘J)">
          <PlusIcon size={16} strokeWidth={2.5} />
          <span>New entry</span>
        </button>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="notebook-primary px-2"
          title="New from template"
          aria-label="New from template"
          aria-expanded={menuOpen}
        >
          <ChevronRightIcon size={14} strokeWidth={2.5} className="rotate-90" />
        </button>
      </div>

      {menuOpen && (
        <TemplateMenu
          className="absolute top-full right-0 mt-2 z-50"
          onSelect={(template) => {
            onCreateFromTemplate?.(template);
            setMenuOpen(false);
          }}
        />
      )}
    </div>
  );
});
