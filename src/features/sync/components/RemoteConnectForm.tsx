import { useState } from "react";
import { useSyncContext } from "../context/SyncContext.tsx";
import { DEFAULT_SERVER_URL } from "../types/sync.ts";
import { validateServerUrl } from "../utils/server-url.ts";

const SYNC_ID_REGEX = /^wl-[0-9a-f]{20}$/;

const inputClass = "w-full text-xs bg-[var(--color-notebook-surface-alt)] border border-[var(--color-notebook-border)] rounded-md px-2 py-1.5 outline-none focus:border-[var(--color-notebook-accent)] text-[var(--color-notebook-text)] placeholder:text-[var(--color-notebook-muted)] font-mono";

interface RemoteConnectFormProps {
  mutedClass: string;
}

export function RemoteConnectForm({ mutedClass }: RemoteConnectFormProps) {
  const { config, status, generateSyncId, connect, setServerUrl } = useSyncContext();
  const [syncIdInput, setSyncIdInput] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState(config.serverUrl ?? "");
  const [serverUrlError, setServerUrlError] = useState<string | null>(null);
  const [showServerUrl, setShowServerUrl] = useState(!!config.serverUrl);
  const [loading, setLoading] = useState(false);

  const inputValid = SYNC_ID_REGEX.test(syncIdInput);

  /** Returns false when the URL is invalid, so callers don't connect to the wrong server. */
  const saveServerUrl = async (): Promise<boolean> => {
    const trimmed = serverUrlInput.trim().replace(/\/+$/, "");
    const url = trimmed && trimmed !== DEFAULT_SERVER_URL ? trimmed : null;
    const error = url ? validateServerUrl(url) : null;
    setServerUrlError(error);
    if (error) return false;
    await setServerUrl(url);
    setServerUrlInput(url ?? "");
    return true;
  };

  const handleGenerate = async () => {
    setLoading(true);
    if (await saveServerUrl()) {
      const id = await generateSyncId();
      if (id) setSyncIdInput(id);
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    const id = syncIdInput.trim();
    if (!SYNC_ID_REGEX.test(id)) return;
    setLoading(true);
    if (await saveServerUrl()) await connect(id);
    setLoading(false);
  };

  return (
    <div className="px-3 pb-2 space-y-2">
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
              className={inputClass}
              disabled={loading}
            />
            {serverUrlError && <p className="text-[10px] text-red-500 mt-1">{serverUrlError}</p>}
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
          className={`flex-1 min-w-0 ${inputClass}`}
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
      <p className={`text-[10px] leading-relaxed ${mutedClass}`}>
        Your sync ID is the encryption key. Save it in a password manager before proceeding.
      </p>
    </div>
  );
}
