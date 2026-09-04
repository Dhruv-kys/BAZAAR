import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
      // The MCP page reads the merchant's contract from the discovery
      // document, which is not under /api. Unproxied, that page is empty in
      // dev and only fills in once VITE_API_BASE_URL is baked into a build.
      "/.well-known": "http://localhost:3001",
    },
  },
});
