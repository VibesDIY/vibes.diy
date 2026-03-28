import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, ViteDevServer } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import { $ } from "zx";
import * as fs from "fs";
import { join } from "path";
import { workspacePackagesPlugin } from "./vite-plugin-workspace-packages.js";

function loadHttpsCerts() {
  const keyPath = "./_wildcard.localhost.vibesdiy.net+1-key.pem";
  const certPath = "./_wildcard.localhost.vibesdiy.net+1.pem";

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  HTTPS certificates not found!                                   ║
║                                                                  ║
║  Run the following commands to generate them:                    ║
║                                                                  ║
║    brew install mkcert                                           ║
║    mkcert -install                                               ║
║    mkcert "*.localhost.vibesdiy.net" localhost                   ║
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

function blockDevVarsPlugin() {
  return {
    name: "block-dev-vars",
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir;
      if (!outDir) return;
      const target = join(outDir, ".dev.vars");
      try {
        fs.rmSync(target);
        console.log(`🗑️  Removed ${target}`);
      } catch {
        /* ignore */
      }
    },
  };
}

function preserveImportMetaUrlPlugin() {
  return {
    name: "preserve-import-meta-url",
    resolveImportMeta(property: string | null) {
      if (property === "url") {
        return "import.meta.url";
      }
      return null;
    },
  };
}

function monacoTrimLanguagesPlugin() {
  return {
    name: "monaco-trim-languages",
    resolveId(id: string) {
      if (id.includes("/basic-languages/") && !id.includes("/javascript/") && !id.includes("/typescript/")) {
        return "\0monaco-empty";
      }
    },
    load(id: string) {
      if (id === "\0monaco-empty") {
        return "export const language = {}; export const conf = {};";
      }
    },
  };
}

async function schemaHash(schemaPath: string): Promise<string> {
  try {
    const content = fs.readFileSync(schemaPath);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", content);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

function setupSqlPlugin() {
  return {
    name: "db-init",
    async configureServer() {
      const isPg = process.env.DB_FLAVOUR === "pg" && !!process.env.NEON_DATABASE_URL;

      const schemaFile = isPg
        ? join(import.meta.dirname, "node_modules/@vibes.diy/api-svc/sql/vibes-diy-api-schema-pg.ts")
        : join(import.meta.dirname, "node_modules/@vibes.diy/api-svc/sql/vibes-diy-api-schema-sqlite.ts");
      const hashFile = join(import.meta.dirname, "dist", isPg ? ".neon-schema-hash" : ".sqlite-schema-hash");

      const currentHash = await schemaHash(schemaFile);
      let cachedHash = "";
      try {
        cachedHash = fs.readFileSync(hashFile, "utf8").trim();
      } catch {
        // no cached hash yet
      }

      if (currentHash !== cachedHash) {
        console.log(`[db-init] schema changed, running drizzle push (${isPg ? "neon" : "d1-local"})...`);
        if (isPg) {
          await $`pnpm run drizzle:neon`;
        } else {
          await $`pnpm run drizzle:d1-local`;
        }
        fs.mkdirSync(join(import.meta.dirname, "dist"), { recursive: true });
        fs.writeFileSync(hashFile, currentHash);
        console.log("[db-init] database ready!");
      } else {
        console.log(`[db-init] schema unchanged, skipping push`);
      }
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

export default defineConfig(({ command }) => ({
  plugins: [
    preserveImportMetaUrlPlugin(),
    blockDevVarsPlugin(),
    monacoTrimLanguagesPlugin(),
    setupSqlPlugin(),
    exposeDevServerInfo(),
    workspacePackagesPlugin(), // { exclude: ["@vibes.diy/vibe-db-explorer"] }),
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
      ...(command === "serve"
        ? {
            auxiliaryWorkers: [{ configPath: "wrangler.queue-consumer.toml" }],
          }
        : {}),
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
    target: "esnext",
  },
  server: {
    host: "127.0.0.1",
    port: 8888,
    allowedHosts: [".localhost.vibesdiy.net"],
    hmr: true,
    https: loadHttpsCerts(),
  },
}));
