interface ConfirmActionProps {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmAction({ label, onConfirm, onCancel, danger }: ConfirmActionProps) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400">{label}</span>
      <button
        onClick={onConfirm}
        className={`text-[10px] font-medium ${danger ? "text-red-500 hover:text-red-600" : "text-amber-600 hover:text-amber-700"}`}
      >
        Yes
      </button>
      <button
        onClick={onCancel}
        className="text-[10px] text-gray-400 hover:text-gray-500"
      >
        No
      </button>
    </span>
  );
}
