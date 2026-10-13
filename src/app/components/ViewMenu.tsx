import { useCallback, useRef, useState } from "react";
import { SIDEBAR_VIEWS, useSidebarData, useSidebarUI } from "../../features/sidebar/index.ts";
import { useClickOutside } from "../../hooks/useClickOutside.ts";
import { CheckIcon, ChevronRightIcon } from "../../components/ui/Icons.tsx";

/** Current view as the header title; opens a menu to switch views without the sidebar. */
export function ViewMenu() {
  const { view, setView } = useSidebarUI();
  const { archivedCount } = useSidebarData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const current = SIDEBAR_VIEWS.find((v) => v.view === view) ?? SIDEBAR_VIEWS[0];

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(e) => {
        // Escape closes only the menu, not focus mode or filters (useKeyboardShortcuts).
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-[var(--color-notebook-surface-alt)] transition-colors max-w-[60vw]"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch view"
      >
        <span className="truncate font-display text-xl font-semibold tracking-[-0.03em] text-[var(--color-notebook-text)]">
          {current.label}
        </span>
        <ChevronRightIcon
          size={16}
          strokeWidth={2.5}
          className={`shrink-0 text-[var(--color-notebook-muted)] transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Views"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 bg-[var(--color-notebook-surface)] border border-[var(--color-notebook-border)] rounded-xl shadow-xl py-1 z-50"
        >
          {SIDEBAR_VIEWS.map(({ view: v, label, icon }) => (
            <button
              key={v}
              role="menuitemradio"
              aria-checked={v === view}
              onClick={() => { setView(v); close(); }}
              className="w-full flex items-center gap-3 px-4 py-3 md:py-2.5 text-sm text-left text-[var(--color-notebook-text)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors"
            >
              <span className="text-[var(--color-notebook-muted)]">{icon}</span>
              <span className="flex-1">{label}</span>
              {v === "archive" && archivedCount > 0 && (
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">{archivedCount}</span>
              )}
              {v === view && <CheckIcon size={14} className="text-[var(--color-notebook-accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
