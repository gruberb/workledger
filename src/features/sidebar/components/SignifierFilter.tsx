import { SIGNIFIER_CONFIG, type EntrySignifier } from "../../entries/index.ts";
import { CollapsibleSectionHeader } from "./CollapsibleSectionHeader.tsx";

interface SignifierFilterProps {
  allSignifiers: string[];
  selectedSignifiers: EntrySignifier[];
  onToggle: (signifier: EntrySignifier) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function SignifierFilter({ allSignifiers, selectedSignifiers, onToggle, collapsed, onToggleCollapse }: SignifierFilterProps) {
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
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
                  isSelected
                    ? `${cfg.color} ${cfg.chip} ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500`
                    : `${cfg.color} ${cfg.chip}`
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
