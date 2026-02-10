import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import { $ } from "zx";
import { workspacePackagesPlugin } from "./vite-plugin-workspace-packages.js";

function setupSqlPlugin() {
  return {
    name: "db-init",
    async configureServer() {
      // This blocks Vite from starting until the promise resolves
      console.log("Initializing database...");
      await $`pnpm run drizzle:d1-local`;
      console.log("Database ready!");
    },
  };
}

export default defineConfig({
  plugins: [
    workspacePackagesPlugin(),
    tailwindcss(),
    tsconfigPaths({
      configNames: ["tsconfig.dev.json"],
    }),
    cloudflare({
      configPath: "wrangler.toml",
    }),
    reactRouter(),
    setupSqlPlugin(),
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  base: process.env.VITE_APP_BASENAME || "/",
  build: {
    outDir: "build",
    manifest: true,
  },
  server: {
    host: "127.0.0.1",
    port: 8888,
    allowedHosts: [".localhost.vibesdiy.net"],
    hmr: true,
  },
});
