import { memo } from "react";
import { SIGNIFIER_CONFIG, type EntrySignifier } from "../../entries/index.ts";
import { CollapsibleSectionHeader } from "./CollapsibleSectionHeader.tsx";

interface SignifierFilterProps {
  allSignifiers: string[];
  selectedSignifiers: EntrySignifier[];
  onToggle: (signifier: EntrySignifier) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SignifierFilter = memo(function SignifierFilter({ allSignifiers, selectedSignifiers, onToggle, collapsed, onToggleCollapse }: SignifierFilterProps) {
  if (allSignifiers.length === 0) return null;

  const isExpanded = !collapsed;

  return (
    <div>
      <CollapsibleSectionHeader label="Signifiers" count={allSignifiers.length} expanded={isExpanded} onToggle={onToggleCollapse} />
      {isExpanded && (
        <div className="flex flex-wrap gap-1.5 px-1 pt-1 mb-3">
          {allSignifiers.map((key) => {
            const cfg = SIGNIFIER_CONFIG[key as EntrySignifier];
            if (!cfg) return null;
            const isSelected = selectedSignifiers.includes(key as EntrySignifier);
            return (
              <button
                key={key}
                onClick={() => onToggle(key as EntrySignifier)}
                className={`sticker ${isSelected ? "shadow-[2px_2px_0_var(--color-notebook-lift)]" : "opacity-80 hover:opacity-100"}`}
                data-signifier={key}
                aria-pressed={isSelected}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
