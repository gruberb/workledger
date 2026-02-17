import { SIGNIFIER_CONFIG, type EntrySignifier } from "../../entries/index.ts";

const BG_COLORS: Record<EntrySignifier, string> = {
  note: "bg-blue-100 dark:bg-blue-950/40",
  decision: "bg-emerald-100 dark:bg-emerald-950/40",
  task: "bg-violet-100 dark:bg-violet-950/40",
  question: "bg-amber-100 dark:bg-amber-950/40",
  idea: "bg-pink-100 dark:bg-pink-950/40",
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
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-1.5 w-full text-left px-1 mb-2"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className={`uppercase tracking-wider text-gray-400 font-medium ${isExpanded ? "text-[11px]" : "text-xs"}`}>
          Signifiers
        </span>
        <span className={`text-gray-300 ml-1 ${isExpanded ? "text-[10px]" : "text-[11px]"}`}>{allSignifiers.length}</span>
      </button>
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
