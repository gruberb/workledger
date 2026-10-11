interface CollapsibleSectionHeaderProps {
  label: string;
  count: number;
  expanded: boolean;
  onToggle?: () => void;
}

export function CollapsibleSectionHeader({ label, count, expanded, onToggle }: CollapsibleSectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full text-left px-1 mb-2"
      aria-expanded={expanded}
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
        className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span className={`uppercase tracking-wider text-gray-400 font-medium ${expanded ? "text-[11px]" : "text-xs"}`}>
        {label}
      </span>
      <span className={`text-gray-300 ml-1 ${expanded ? "text-[10px]" : "text-[11px]"}`}>{count}</span>
    </button>
  );
}
