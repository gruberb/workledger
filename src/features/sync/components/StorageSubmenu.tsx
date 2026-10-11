import { useEffect, useState } from "react";
import { useSyncContext } from "../context/SyncContext.tsx";
import { getAllEntryIds } from "../../entries/index.ts";
import { RemoteConnectForm } from "./RemoteConnectForm.tsx";
import { RemoteConnectedPanel } from "./RemoteConnectedPanel.tsx";
import { AccountDangerZone } from "./AccountDangerZone.tsx";

interface StorageSubmenuProps {
  mutedClass: string;
  dividerClass: string;
  onBack: () => void;
}

export function StorageSubmenu({ mutedClass, dividerClass, onBack }: StorageSubmenuProps) {
  const { config, status, setMode } = useSyncContext();
  const [entryCount, setEntryCount] = useState<number | null>(null);

  const isRemote = config.mode === "remote";
  const isConnected = isRemote && !!config.syncId && !!config.salt;
  // Switching mode mid-connect would race the connect flow.
  const isConnecting = status.phase === "connecting";

  // Count from storage: in-memory state only holds recent, non-archived days.
  useEffect(() => {
    let cancelled = false;
    getAllEntryIds().then((ids) => {
      if (!cancelled) setEntryCount(ids.length);
    });
    return () => { cancelled = true; };
  }, [status.lastSyncAt]);

  const toggleClass = (active: boolean) =>
    `flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active
        ? "bg-[var(--color-notebook-surface)] text-[var(--color-notebook-text)] shadow-sm"
        : `${mutedClass} hover:text-[var(--color-notebook-text)]`
    }`;

  return (
    <>
      <button
        onClick={onBack}
        className={`w-full text-left px-3 py-2 text-sm ${mutedClass} hover:bg-[var(--color-notebook-surface-alt)] transition-colors flex items-center gap-1.5`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="text-[10px] uppercase tracking-wider font-medium">Storage</span>
      </button>
      <div className={dividerClass} />

      <div className="px-3 py-2">
        <div className="flex gap-1 p-0.5 bg-[var(--color-notebook-surface-alt)] rounded-lg">
          <button onClick={() => { if (isRemote) setMode("local"); }} className={toggleClass(!isRemote)} disabled={isConnecting}>
            Local
          </button>
          <button onClick={() => { if (!isRemote) setMode("remote"); }} className={toggleClass(isRemote)} disabled={isConnecting}>
            Remote
          </button>
        </div>
      </div>

      {!isRemote && (
        <div className="px-3 pb-2">
          <p className={`text-[10px] leading-relaxed ${mutedClass}`}>
            Data stored in your browser only.
            {config.syncId && " Your sync ID stays saved in this browser, so switching back to Remote sends the changes made meanwhile. Disconnect in Remote mode to remove it."}
          </p>
        </div>
      )}
      {isRemote && !isConnected && <RemoteConnectForm mutedClass={mutedClass} />}
      {isConnected && <RemoteConnectedPanel mutedClass={mutedClass} />}

      <div className={dividerClass} />
      {entryCount !== null && (
        <div className="px-3 py-1.5">
          <span className={`text-[11px] ${mutedClass}`}>
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}

      {isConnected && (
        <>
          <div className={dividerClass} />
          <AccountDangerZone mutedClass={mutedClass} />
        </>
      )}
    </>
  );
}
