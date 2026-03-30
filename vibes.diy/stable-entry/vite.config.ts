import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { readFileSync } from "fs";
import { join } from "path";

const SPA_PREFIX = "/@stable-entry";

// Vite-internal paths stay at root — never prefix these
const VITE_INTERNAL = ["/node_modules/", "/@vite/", "/@fs/", "/__vite"];

function isViteInternal(p: string): boolean {
  return VITE_INTERNAL.some((prefix) => p.startsWith(prefix));
}

// Rewrite absolute app-module imports to include /@stable-entry prefix
// so the browser routes them back through the worker → ASSETS → this middleware.
// Vite-internal paths are left untouched.
function rewriteImports(code: string): string {
  return code.replace(/(['"])(\/[^'"]+)(['"])/g, (match, q1, path, q2) =>
    isViteInternal(path) ? match : `${q1}${SPA_PREFIX}${path}${q2}`
  );
}

function stableEntryPlugin(): Plugin {
  return {
    name: "stable-entry",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "/";
        if (!url.startsWith(SPA_PREFIX)) return next();

        const stripped = url.slice(SPA_PREFIX.length) || "/";

        if (stripped === "/" || stripped === "/index.html") {
          const html = readFileSync(join(server.config.root, "index.html"), "utf-8");
          const transformed = await server.transformIndexHtml(url, html);
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(transformed);
          return;
        }

        const result = await server.transformRequest(stripped);
        if (result) {
          res.setHeader("content-type", "application/javascript; charset=utf-8");
          res.end(rewriteImports(result.code));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? `${SPA_PREFIX}/` : "/",
  appType: "custom",
  plugins: [cloudflare(), react(), stableEntryPlugin()],
  build: {
    outDir: "dist/spa",
    emptyOutDir: true,
  },
}));
