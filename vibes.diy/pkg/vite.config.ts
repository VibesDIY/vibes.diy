import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, ViteDevServer } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import { $ } from "zx";
import * as fs from "fs";
import { workspacePackagesPlugin } from "./vite-plugin-workspace-packages.js";

function loadHttpsCerts() {
  const keyPath = "./_wildcard.localhost.vibesdiy.net+1-key.pem";
  const certPath = "./_wildcard.localhost.vibesdiy.net+1.pem";

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  HTTPS certificates not found!                                  ║
║                                                                  ║
║  Run the following commands to generate them:                    ║
║                                                                  ║
║    brew install mkcert                                           ║
║    mkcert -install                                               ║
║    mkcert "*.localhost.vibesdiy.net" localhost                    ║
║                                                                  ║
║  Then move the generated .pem files to vibes.diy/pkg/            ║
╚══════════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

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

const DEV_HOST = "vite.localhost.vibesdiy.net";

let viteDevServer: ViteDevServer | null = null;
function exposeDevServerInfo() {
  return {
    enforce: "pre" as const,
    name: "expose-dev-server-info",
    configureServer(server: ViteDevServer) {
      viteDevServer = server;
      server.printUrls = () => {
        const port = server.config.server.port;
        server.config.logger.info(`  ➜  Dev: https://${DEV_HOST}:${port}/`);
      };
      // With HTTP/2 (enabled by HTTPS), the hostname arrives as the :authority
      // pseudo-header instead of Host. The Cloudflare Vite plugin's createHeaders()
      // skips all pseudo-headers (starting with ":"), so Host is lost and falls back
      // to "localhost". This middleware extracts :authority and injects a real Host header.
      server.middlewares.use((req, _res, next) => {
        if (!req.headers.host) {
          const authorityIdx = req.rawHeaders.indexOf(":authority");
          if (authorityIdx >= 0) {
            const authority = req.rawHeaders[authorityIdx + 1];
            req.headers.host = authority;
            req.rawHeaders.push("Host", authority);
          }
        }
        next();
      });
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
            DEV_SERVER_HOST: viteDevServer?.config.server.host?.toString() || "vite.localhost.vibesdiy.net",
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
    https: loadHttpsCerts(),
  },
});
