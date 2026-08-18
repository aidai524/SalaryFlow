import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Development proxy: /api → local Cloudflare Worker (wrangler dev)
// Production: deploy the Worker behind the same origin (Cloudflare Pages + Functions or custom route).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Vite 7: same polyfill setup as stableflow-interface.
    // Do not alias `process` to the string "process/browser" — that rewrites
    // `require("process/")` into a broken project-root path.
    nodePolyfills({
      include: ["buffer", "process", "stream", "util"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    global: "globalThis",
    "process.env": "{}",
    "process.browser": "true",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
        "process.env": "{}",
        "process.browser": "true",
      },
    },
    include: ["buffer", "process", "stream", "util", "near-api-js"],
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
