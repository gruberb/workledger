interface NewEntryButtonProps {
  onClick: () => void;
}

export function NewEntryButton({ onClick }: NewEntryButtonProps) {
  return (
    <button
      onClick={onClick}
      className="
        fixed bottom-8 right-8 z-40
        flex items-center gap-2
        bg-orange-500 hover:bg-orange-400 active:bg-orange-600
        text-white font-medium
        px-6 py-3.5 rounded-full
        shadow-lg shadow-orange-500/20 dark:shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/25 dark:hover:shadow-orange-500/35
        transition-all duration-200
        hover:scale-[1.02]
        group
      "
      title="New Entry (⌘J)"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span className="text-sm">New Entry</span>
    </button>
  );
}
