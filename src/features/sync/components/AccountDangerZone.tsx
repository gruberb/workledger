import { useState } from "react";
import { useSyncContext } from "../context/SyncContext.tsx";

interface AccountDangerZoneProps {
  mutedClass: string;
}

export function AccountDangerZone({ mutedClass }: AccountDangerZoneProps) {
  const { status, disconnect, deleteAccount } = useSyncContext();
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDisconnect = async () => {
    setLoading(true);
    await disconnect();
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    setLoading(true);
    // On failure the account stays connected and the error shows below.
    if (await deleteAccount()) setConfirmDelete(false);
    setLoading(false);
  };

  return (
    <div className="px-3 py-1.5 space-y-1.5">
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className={`w-full text-xs px-3 py-1.5 rounded-md border border-[var(--color-notebook-border)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors ${mutedClass} hover:text-[var(--color-notebook-text)] disabled:opacity-50`}
      >
        Disconnect
      </button>
      <p className={`text-[10px] leading-relaxed ${mutedClass}`}>
        Disconnect removes the sync ID from this device but keeps your server account. You can reconnect later with the same ID.
      </p>
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={loading}
          className="w-full text-xs px-3 py-1.5 rounded-md border border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
        >
          Delete account
        </button>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-red-500">This permanently deletes your server account and all synced entries. Local data is kept.</p>
          {status.error && <p className="text-[10px] text-red-500">{status.error}</p>}
          <div className="flex gap-1.5">
            <button
              onClick={() => setConfirmDelete(false)}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md border border-[var(--color-notebook-border)] ${mutedClass} hover:text-[var(--color-notebook-text)] transition-colors`}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className="flex-1 text-xs px-2 py-1.5 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              Confirm delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
