import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, ViteDevServer } from "vite";
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

let viteDevServer: ViteDevServer | null = null;
function exposeDevServerInfo() {
  return {
    enforce: "pre" as const,
    name: "expose-dev-server-info",
    configureServer(server: ViteDevServer) {
      viteDevServer = server;
    },
  };
}

export default defineConfig({
  plugins: [
    setupSqlPlugin(),
    exposeDevServerInfo(),
    workspacePackagesPlugin(),
    tailwindcss(),
    tsconfigPaths({
      configNames: ["tsconfig.dev.json"],
    }),
    cloudflare({
      configPath: "wrangler.toml",
      config(workerConfig) {
        // Inject dev server info as vars
        return {
          vars: {
            ...workerConfig.vars,
            DEV_SERVER_HOST: viteDevServer?.config.server.host?.toString() || "localhost",
            DEV_SERVER_PORT: viteDevServer?.config.server.port?.toString() || "8888",
          },
        };
      },
    }),
    reactRouter(),
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
