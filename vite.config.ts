import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  optimizeDeps: {
    include: [
      "@excalidraw/excalidraw",
      "png-chunks-extract",
      "png-chunk-text",
    ],
  },
});
