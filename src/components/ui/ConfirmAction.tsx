interface ConfirmActionProps {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmAction({ label, onConfirm, onCancel, danger }: ConfirmActionProps) {
  return (
    <span className="flex items-center gap-1">
      <span className="px-2 text-xs text-[var(--color-notebook-muted)]">{label}</span>
      <button
        onClick={onConfirm}
        className={`entry-action font-medium ${danger ? "text-red-500 hover:text-red-600" : "text-amber-600 hover:text-amber-700"}`}
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        className="entry-action"
      >
        No
      </button>
    </span>
  );
}
