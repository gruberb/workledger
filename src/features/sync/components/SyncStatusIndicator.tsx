import { useSyncContext } from "../context/SyncContext.tsx";

export function SyncStatusIndicator() {
  const { config, status } = useSyncContext();

  if (config.mode !== "remote") return null;

  const isConnected = config.syncId && config.salt;

  if (!isConnected) return null;

  if (status.phase === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-red-500">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
        Error
      </span>
    );
  }

  if (status.phase === "pushing" || status.phase === "pulling" || status.phase === "merging") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-notebook-muted)]">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
        Syncing...
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-notebook-muted)]">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
      Synced
    </span>
  );
}
