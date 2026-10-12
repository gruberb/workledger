interface StatusToastProps {
  message: string | null;
  tone?: "success" | "error";
}

export function StatusToast({ message, tone = "success" }: StatusToastProps) {
  if (!message) return null;
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-fade-in" role="status" aria-live="polite">
      <div className={`
        px-4 py-2.5 rounded-full shadow-lg text-sm font-medium
        ${tone === "error"
          ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
          : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
        }
      `}>
        {message}
      </div>
    </div>
  );
}
