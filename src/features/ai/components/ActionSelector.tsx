import { AI_ACTIONS, CATEGORY_LABELS, CATEGORY_ORDER } from "../actions/actions.ts";
import type { AIAction } from "../actions/types.ts";

interface ActionSelectorProps {
  onSelectAction: (action: AIAction) => void;
  hasTargetEntry: boolean;
}

const SCOPE_LABELS: Record<string, string> = {
  entry: "This entry",
  day: "Today",
  week: "This week",
  topic: "Search",
};

export function ActionSelector({ onSelectAction, hasTargetEntry }: ActionSelectorProps) {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: AI_ACTIONS.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="px-4 py-4 overflow-y-auto h-full">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
        What would you like to do?
      </h3>
      {grouped.map((group) => (
        <div key={group.category} className="mb-5">
          <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-2 px-1">
            {group.label}
          </h4>
          <div className="space-y-1.5">
            {group.items.map((action) => {
              const needsEntry = action.scope === "entry";
              const disabled = needsEntry && !hasTargetEntry;
              return (
                <button
                  key={action.id}
                  onClick={() => !disabled && onSelectAction(action)}
                  disabled={disabled}
                  className={`
                    w-full text-left p-3 rounded-xl border transition-all
                    ${disabled
                      ? "border-gray-100 dark:border-gray-800 opacity-40 cursor-not-allowed"
                      : "border-gray-100 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-800 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 cursor-pointer"
                    }
                  `}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${disabled ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>
                          {action.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 shrink-0">
                          {SCOPE_LABELS[action.scope]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!hasTargetEntry && (
        <p className="text-[11px] text-gray-400 text-center mt-4 px-4">
          Actions marked "This entry" need a note selected — click the lightbulb on any entry.
        </p>
      )}
    </div>
  );
}
