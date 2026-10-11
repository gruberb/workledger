import { useEffect, useState } from "react";
import { on } from "../../utils/events.ts";

interface StorageStatusBannerProps {
  /** Load error from the entries store, if any. */
  error: string | null;
  /** True once data has loaded; clears the "blocked" notice after the upgrade went through. */
  loaded: boolean;
}

/** Surfaces storage states that otherwise look like a hang or silently drop writes. */
export function StorageStatusBanner({ error, loaded }: StorageStatusBannerProps) {
  const [blocked, setBlocked] = useState(false);
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    const unsubBlocked = on("db-blocked", () => setBlocked(true));
    const unsubOutdated = on("db-outdated", () => setOutdated(true));
    return () => {
      unsubBlocked();
      unsubOutdated();
    };
  }, []);

  let message: string | null = null;
  if (outdated) {
    message = "WorkLedger was updated in another tab. Reload this tab to keep saving.";
  } else if (blocked && !loaded) {
    message = "WorkLedger is upgrading its database. Close other WorkLedger tabs to continue.";
  } else if (error) {
    message = `Could not load your notebook: ${error}`;
  }
  if (!message) return null;

  return (
    <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md px-4 py-2.5 rounded-lg shadow-lg text-sm bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
      <span>{message}</span>
      {(outdated || error) && (
        <button onClick={() => window.location.reload()} className="font-medium underline shrink-0">
          Reload
        </button>
      )}
    </div>
  );
}
