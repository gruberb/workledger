import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Lazy chunks only reachable through Excalidraw's "Mermaid to Excalidraw"
// dialog or its non-English locales (the app always renders Excalidraw in
// English). Precaching them cost several MB per install for features that
// can still load on demand when online.
const MERMAID_MODULE = /node_modules\/(mermaid|@excalidraw\/mermaid-to-excalidraw|elkjs|cytoscape[^/]*|cose-base|layout-base|katex|dagre-d3-es)\//;
const EXCALIDRAW_LOCALE_MODULE = /node_modules\/@excalidraw\/excalidraw\/dist\/[^/]+\/locales\//;
const CORE_MODULE = /^(?!.*node_modules)|node_modules\/@excalidraw\/excalidraw\/(?!.*\/locales\/)/;

const optionalChunks = new Set<string>();

function isOptionalChunk(moduleIds: string[]): boolean {
  if (moduleIds.length === 0 || moduleIds.some((id) => CORE_MODULE.test(id))) return false;
  return moduleIds.every((id) => EXCALIDRAW_LOCALE_MODULE.test(id)) || moduleIds.some((id) => MERMAID_MODULE.test(id));
}

/** Records optional chunk file names so the service worker can skip precaching them. */
function markOptionalChunks(): Plugin {
  return {
    name: "workledger:mark-optional-chunks",
    apply: "build",
    generateBundle(_, bundle) {
      optionalChunks.clear();
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" && isOptionalChunk(Object.keys(chunk.modules))) optionalChunks.add(fileName);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    markOptionalChunks(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.filter((entry) => !optionalChunks.has(entry.url)),
            warnings: [],
          }),
        ],
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: undefined,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              expiration: { maxEntries: 1 },
            },
          },
        ],
      },
      manifest: {
        name: "WorkLedger",
        short_name: "WorkLedger",
        description: "Local-first engineering notebook",
        theme_color: "#f97316",
        background_color: "#fafafa",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Excalidraw is deliberately not listed: it is only reached through
        // dynamic import(), so Rollup keeps it (and its own lazy chunks) out
        // of the startup bundle. Listing it, in either manualChunks form,
        // pulled it, or shared dependencies, into what loads at startup.
        manualChunks(id) {
          if (id.includes("/node_modules/@blocknote/")) return "blocknote";
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "@excalidraw/excalidraw",
      "png-chunks-extract",
      "png-chunk-text",
    ],
  },
});
