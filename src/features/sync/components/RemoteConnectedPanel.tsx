import { useState } from "react";
import { useSyncContext } from "../context/SyncContext.tsx";
import { SyncStatusIndicator } from "./SyncStatusIndicator.tsx";
import { DEFAULT_SERVER_URL } from "../types/sync.ts";

function formatSyncTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() !== now.toDateString()) {
    const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${day}, ${time}`;
  }
  return time;
}

interface RemoteConnectedPanelProps {
  mutedClass: string;
}

export function RemoteConnectedPanel({ mutedClass }: RemoteConnectedPanelProps) {
  const { config, status, syncNow } = useSyncContext();
  const [copied, setCopied] = useState(false);
  const isSyncing = status.phase !== "idle" && status.phase !== "error";

  const handleCopy = async () => {
    if (!config.syncId) return;
    try {
      await navigator.clipboard.writeText(config.syncId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied; the ID is still selectable (select-all).
    }
  };

  const handleSyncNow = () => {
    if (!isSyncing) void syncNow();
  };

  return (
    <div className="px-3 pb-2 space-y-2">
      <label className={`text-[10px] uppercase tracking-wider font-medium ${mutedClass}`}>
        Sync ID
      </label>
      <div className="flex items-start gap-1.5">
        <span className="flex-1 text-xs font-mono text-[var(--color-notebook-text)] break-all select-all leading-relaxed">
          {config.syncId}
        </span>
        <button
          onClick={handleCopy}
          className={`p-1 rounded hover:bg-[var(--color-notebook-surface-alt)] ${mutedClass} hover:text-[var(--color-notebook-text)] transition-colors shrink-0`}
          title="Copy sync ID"
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <SyncStatusIndicator />
        {status.lastSyncAt && (
          <span className={`text-[10px] ${mutedClass}`}>
            {formatSyncTime(status.lastSyncAt)}
          </span>
        )}
      </div>

      <button
        onClick={handleSyncNow}
        disabled={isSyncing}
        className={`w-full text-xs px-3 py-1.5 rounded-md border border-[var(--color-notebook-border)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors ${mutedClass} hover:text-[var(--color-notebook-text)] disabled:opacity-50 flex items-center justify-center gap-1.5`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? "animate-spin" : ""}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
          <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
        Sync now
      </button>

      {status.error && (
        <p className="text-[10px] text-red-500">{status.error}</p>
      )}

      <p className={`text-[10px] font-mono ${mutedClass} break-all`}>
        {config.serverUrl || DEFAULT_SERVER_URL}
      </p>

      <p className={`text-[10px] leading-relaxed ${mutedClass}`}>
        Your sync ID is stored in this browser. Save it in a password manager so you can reconnect from other devices.
      </p>
    </div>
  );
}
