interface ConfirmActionProps {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmAction({ label, onConfirm, onCancel, danger }: ConfirmActionProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs text-[var(--color-notebook-muted)]">{label}</span>
      <button
        onClick={onConfirm}
        className={`text-xs px-2 py-2 font-medium ${danger ? "text-red-500 hover:text-red-600" : "text-amber-600 hover:text-amber-700"}`}
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-[var(--color-notebook-muted)] hover:text-gray-500"
      >
        No
      </button>
    </span>
  );
}
