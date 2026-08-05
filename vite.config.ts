import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Development proxy: /api → local Cloudflare Worker (wrangler dev)
// Production: deploy the Worker behind the same origin (Cloudflare Pages + Functions or custom route).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
