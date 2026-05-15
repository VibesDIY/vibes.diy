import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "node:path";

// Standalone Vite SPA for the growth-reports page. Bundles into
// ../build/client/reports/ so the existing single ASSETS binding in
// pkg/wrangler.toml serves it — no second worker, no second [[assets]]
// block. workers/app.ts routes /reports* → env.ASSETS.fetch.
//
// base: "/reports/" makes Vite emit hashed asset URLs as
// /reports/assets/<chunk>-HASH.js, which lines up with how the worker
// serves files relative to the bundle root.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: "/reports/",
  build: {
    outDir: path.resolve(__dirname, "../build/client/reports"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
