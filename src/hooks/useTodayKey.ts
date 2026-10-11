import { useSyncExternalStore } from "react";
import { todayKey } from "../utils/dates.ts";

// One shared timer for all subscribers instead of one per mounted card.
let current = todayKey();
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function update() {
  const next = todayKey();
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

function scheduleMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  timer = setTimeout(() => {
    update();
    scheduleMidnight();
  }, midnight.getTime() - now.getTime() + 1000);
}

// Timers are paused while the machine sleeps, so re-check when the tab becomes visible.
function handleVisibility() {
  if (document.visibilityState === "visible") update();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    update();
    scheduleMidnight();
    document.addEventListener("visibilitychange", handleVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    }
  };
}

/** Today's day key; re-renders subscribers when the local date changes. */
export function useTodayKey(): string {
  return useSyncExternalStore(subscribe, () => current);
}
