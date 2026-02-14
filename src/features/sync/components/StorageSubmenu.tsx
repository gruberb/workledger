import { useState } from "react";
import { useSyncContext } from "../context/SyncContext.tsx";
import { useEntriesData } from "../../entries/index.ts";
import { SyncStatusIndicator } from "./SyncStatusIndicator.tsx";
import { DEFAULT_SERVER_URL } from "../types/sync.ts";

interface StorageSubmenuProps {
  menuItemClass: string;
  mutedClass: string;
  dividerClass: string;
  onBack: () => void;
}

const SYNC_ID_REGEX = /^wl-[0-9a-f]{20}$/;

function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return "Never";
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() !== now.toDateString()) {
    const day = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${day}, ${time}`;
  }
  return time;
}

export function StorageSubmenu({ mutedClass, dividerClass, onBack }: StorageSubmenuProps) {
  const { config, status, generateSyncId, connect, disconnect, setMode, setServerUrl, syncNow } = useSyncContext();
  const { entriesByDay } = useEntriesData();
  const [syncIdInput, setSyncIdInput] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState(config.serverUrl ?? "");
  const [showServerUrl, setShowServerUrl] = useState(!!config.serverUrl);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRemote = config.mode === "remote";
  const isConnected = isRemote && !!config.syncId && !!config.salt;
  const inputValid = SYNC_ID_REGEX.test(syncIdInput);
  const isSyncing = status.phase === "pushing" || status.phase === "pulling" || status.phase === "merging";

  const entryCount = Array.from(entriesByDay.values()).reduce((sum, entries) => sum + entries.length, 0);

  const saveServerUrl = async () => {
    const trimmed = serverUrlInput.trim().replace(/\/+$/, "");
    if (trimmed && trimmed !== DEFAULT_SERVER_URL) {
      await setServerUrl(trimmed);
      setServerUrlInput(trimmed);
    } else {
      await setServerUrl(null);
      setServerUrlInput("");
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    await saveServerUrl();
    const id = await generateSyncId();
    if (id) setSyncIdInput(id);
    setLoading(false);
  };

  const handleConnect = async () => {
    const id = syncIdInput.trim();
    if (!SYNC_ID_REGEX.test(id)) return;
    setLoading(true);
    await saveServerUrl();
    await connect(id);
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    await disconnect();
    setSyncIdInput("");
    setLoading(false);
  };

  const handleCopy = () => {
    if (config.syncId) {
      navigator.clipboard.writeText(config.syncId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSyncNow = async () => {
    if (isSyncing) return;
    await syncNow();
  };

  const toggleClass = (active: boolean) =>
    `flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      active
        ? "bg-[var(--color-notebook-surface)] text-[var(--color-notebook-text)] shadow-sm"
        : `${mutedClass} hover:text-[var(--color-notebook-text)]`
    }`;

  const helperTextClass = `text-[10px] leading-relaxed ${mutedClass}`;

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

      {/* Mode toggle */}
      <div className="px-3 py-2">
        <div className="flex gap-1 p-0.5 bg-[var(--color-notebook-surface-alt)] rounded-lg">
          <button
            onClick={() => { if (isRemote) setMode("local"); }}
            className={toggleClass(!isRemote)}
            disabled={loading}
          >
            Local
          </button>
          <button
            onClick={() => { if (!isRemote) setMode("remote"); }}
            className={toggleClass(isRemote)}
            disabled={loading}
          >
            Remote
          </button>
        </div>
      </div>

      {/* Local mode */}
      {!isRemote && (
        <div className="px-3 pb-2">
          <p className={helperTextClass}>
            Data stored in your browser only.
          </p>
        </div>
      )}

      {/* Remote mode — not connected */}
      {isRemote && !isConnected && (
        <div className="px-3 pb-2 space-y-2">
          {/* Server endpoint */}
          <div>
            <button
              onClick={() => setShowServerUrl(!showServerUrl)}
              className={`text-[10px] ${mutedClass} hover:text-[var(--color-notebook-text)] transition-colors flex items-center gap-1`}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showServerUrl ? "rotate-90" : ""}`}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Server endpoint
            </button>
            {showServerUrl && (
              <div className="mt-1.5">
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  onBlur={saveServerUrl}
                  placeholder={DEFAULT_SERVER_URL}
                  className="w-full text-xs bg-[var(--color-notebook-surface-alt)] border border-[var(--color-notebook-border)] rounded-md px-2 py-1.5 outline-none focus:border-[var(--color-notebook-accent)] text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)] font-mono"
                  disabled={loading}
                />
                <p className={`text-[10px] leading-relaxed mt-1 ${mutedClass}`}>
                  Default: {DEFAULT_SERVER_URL}. <a href="https://github.com/gruberb/workledger-sync" target="_blank" rel="noopener" className="underline hover:text-[var(--color-notebook-text)]">Self-host your own</a>.
                </p>
              </div>
            )}
          </div>

          <label className={`text-[10px] uppercase tracking-wider font-medium ${mutedClass}`}>
            Sync ID
          </label>
          <div className="flex gap-1.5 min-w-0">
            <input
              type="text"
              value={syncIdInput}
              onChange={(e) => setSyncIdInput(e.target.value.toLowerCase())}
              placeholder="wl-"
              className="flex-1 min-w-0 text-xs bg-[var(--color-notebook-surface-alt)] border border-[var(--color-notebook-border)] rounded-md px-2 py-1.5 outline-none focus:border-[var(--color-notebook-accent)] text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)] font-mono"
              disabled={loading}
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`flex-1 text-xs px-2 py-1.5 rounded-md border border-[var(--color-notebook-border)] hover:bg-[var(--color-notebook-surface-alt)] transition-colors ${mutedClass} hover:text-[var(--color-notebook-text)] disabled:opacity-50`}
            >
              Generate
            </button>
            <button
              onClick={handleConnect}
              disabled={loading || !inputValid}
              className="flex-1 text-xs px-2 py-1.5 rounded-md bg-[var(--color-notebook-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
          {syncIdInput && !inputValid && (
            <p className="text-[10px] text-red-500">Format: wl- followed by 20 hex characters</p>
          )}
          {status.error && (
            <p className="text-[10px] text-red-500">{status.error}</p>
          )}
          <p className={helperTextClass}>
            Entries will be encrypted and synced across devices. Save your sync ID — it's your only way to access your data.
          </p>
        </div>
      )}

      {/* Remote mode — connected */}
      {isConnected && (
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

          {config.serverUrl && (
            <p className={`text-[10px] font-mono ${mutedClass} break-all`}>
              {config.serverUrl}
            </p>
          )}

          <p className={helperTextClass}>
            Edits and deletes sync to all devices. Disconnect keeps your local data but stops syncing.
          </p>
        </div>
      )}

      <div className={dividerClass} />

      {/* Entry count */}
      <div className="px-3 py-1.5">
        <span className={`text-[11px] ${mutedClass}`}>
          {entryCount} {entryCount === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Disconnect button — separated at bottom */}
      {isConnected && (
        <>
          <div className={dividerClass} />
          <div className="px-3 py-1.5">
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full text-xs px-3 py-1.5 rounded-md border border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </>
  );
}
