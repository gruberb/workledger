import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./app/App.tsx";
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
}

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
