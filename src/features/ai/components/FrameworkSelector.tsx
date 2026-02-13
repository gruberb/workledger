import { getAllFrameworks } from "../frameworks/registry.ts";
import type { ThinkingFramework } from "../frameworks/types.ts";

interface FrameworkSelectorProps {
  onSelectFramework: (framework: ThinkingFramework) => void;
}

const CATEGORY_LABELS: Record<ThinkingFramework["category"], string> = {
  analytical: "Analytical",
  creative: "Creative",
  decision: "Decision Making",
  strategic: "Strategic",
};

const CATEGORY_ORDER: ThinkingFramework["category"][] = [
  "analytical",
  "creative",
  "decision",
  "strategic",
];

export function FrameworkSelector({ onSelectFramework }: FrameworkSelectorProps) {
  const frameworks = getAllFrameworks();

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: frameworks.filter((f) => f.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="px-4 py-4 overflow-y-auto h-full">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
        Choose a thinking framework
      </h3>
      {grouped.map((group) => (
        <div key={group.category} className="mb-5">
          <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-medium mb-2 px-1">
            {group.label}
          </h4>
          <div className="space-y-2">
            {group.items.map((framework) => (
              <button
                key={framework.id}
                onClick={() => onSelectFramework(framework)}
                className="w-full text-left p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-800 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 transition-all group"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg shrink-0 mt-0.5">{framework.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors">
                      {framework.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {framework.author}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {framework.description}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {framework.steps.map((step) => (
                        <span
                          key={step.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        >
                          {step.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
