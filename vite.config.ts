import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
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
        manualChunks: {
          excalidraw: ["@excalidraw/excalidraw"],
          blocknote: [
            "@blocknote/core",
            "@blocknote/react",
            "@blocknote/mantine",
          ],
          shiki: ["shiki"],
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
