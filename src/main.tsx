import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./app/App.tsx";
import "@mantine/core/styles.css";
import "./app.css";

// Privacy-friendly analytics (Plausible) — only loads when VITE_PLAUSIBLE_SRC
// is set as an environment variable in the hosting platform (e.g. Vercel).
// Not committed to source so open-source forks don't inherit tracking.
const plausibleSrc = import.meta.env.VITE_PLAUSIBLE_SRC;
if (plausibleSrc) {
  const script = document.createElement("script");
  script.async = true;
  script.src = plausibleSrc;
  document.head.appendChild(script);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  w.plausible =
    w.plausible ||
    function (...args: unknown[]) {
      (w.plausible.q = w.plausible.q || []).push(args);
    };
  w.plausible.init =
    w.plausible.init ||
    function (i?: Record<string, unknown>) {
      w.plausible.o = i || {};
    };
  w.plausible.init();
}

// A tab opened before a release still imports the old hashed chunks, which the
// host stops serving after the deploy. On-demand chunks (PDF/Word export, the
// Anthropic SDK, Excalidraw extras) are not precached, so their imports fail
// until the page loads the new build. Reload once; the session flag stops a
// loop when the chunk is missing for another reason (offline, a bad deploy),
// and the caller then shows its own error.
const CHUNK_RELOAD_KEY = "workledger-chunk-reload";
window.addEventListener("vite:preloadError", (event) => {
  // Offline, a reload can't fetch the new build either; the caller says so.
  if (!navigator.onLine || sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  event.preventDefault();
  window.location.reload();
});
// Cleared once this build has run a while, so a later release in the same tab
// can reload again.
setTimeout(() => sessionStorage.removeItem(CHUNK_RELOAD_KEY), 30_000);

registerSW({
  onNeedRefresh() {
    // New version deployed — reload to pick it up
    window.location.reload();
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
