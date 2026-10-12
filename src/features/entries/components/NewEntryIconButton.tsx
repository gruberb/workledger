import { useState, useRef, useCallback } from "react";
import type { EntryTemplate } from "../utils/templates.ts";
import { useClickOutside } from "../../../hooks/useClickOutside.ts";
import { PlusIcon } from "../../../components/ui/Icons.tsx";
import { TemplateMenu } from "./TemplateMenu.tsx";

interface NewEntryIconButtonProps {
  onClick: () => void;
  onCreateFromTemplate: (template: EntryTemplate) => void;
  /** How long a press must last to open the template menu instead of creating. */
  longPressMs?: number;
}

/** Compact "+" for the header: tap creates a blank entry, long-press offers templates. */
export function NewEntryIconButton({ onClick, onCreateFromTemplate, longPressMs = 450 }: NewEntryIconButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useClickOutside(wrapperRef, closeMenu, menuOpen);

  const cancelTimer = () => window.clearTimeout(timer.current);

  const handlePointerDown = () => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      setMenuOpen(true);
    }, longPressMs);
  };

  const handleClick = () => {
    // The click that ends a long-press must not also create a blank entry.
    if (longPressed.current) return;
    onClick();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={cancelTimer}
        onPointerLeave={cancelTimer}
        onPointerCancel={cancelTimer}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
        onClick={handleClick}
        className="w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white flex items-center justify-center shadow-sm transition-colors select-none touch-manipulation"
        title="New entry (long-press for templates)"
        aria-label="New entry"
        aria-haspopup="menu"
      >
        <PlusIcon size={18} strokeWidth={2.5} />
      </button>
      {menuOpen && (
        <TemplateMenu
          className="absolute top-full right-0 mt-2 z-50"
          onSelect={(template) => { setMenuOpen(false); onCreateFromTemplate(template); }}
        />
      )}
    </div>
  );
}
