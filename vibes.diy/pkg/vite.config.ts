import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";
import { $ } from "zx";

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
    tailwindcss(),
    tsconfigPaths({
      configNames: ["tsconfig.dev.json"],
    }),
    cloudflare({
      configPath: "wrangler.toml",
    }),
    reactRouter(),
    setupSqlPlugin(),
  ],
  base: process.env.VITE_APP_BASENAME || "/",
  build: {
    outDir: "build",
  },
  server: {
    host: "127.0.0.1",
    port: 8888,
    allowedHosts: [".localhost.vibesdiy.net"],
    hmr: true,
  },
});
