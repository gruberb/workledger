import { SIGNIFIER_CONFIG, type EntrySignifier } from "../../entries/index.ts";
import { CollapsibleSectionHeader } from "./CollapsibleSectionHeader.tsx";

const BG_COLORS: Record<EntrySignifier, string> = {
  decision: "bg-emerald-100 dark:bg-emerald-950/40",
  question: "bg-amber-100 dark:bg-amber-950/40",
  idea: "bg-pink-100 dark:bg-pink-950/40",
  milestone: "bg-blue-100 dark:bg-blue-950/40",
};

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
                    ? `${cfg.color} ${BG_COLORS[key as EntrySignifier]} ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500`
                    : `${cfg.color} ${BG_COLORS[key as EntrySignifier]}`
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
