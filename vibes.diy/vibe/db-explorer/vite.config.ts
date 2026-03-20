import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";

function entryAliasPlugin(): Plugin {
  return {
    name: "entry-alias",
    configureServer(server) {
      const map: Record<string, string> = {
        "/start": "/db-explorer-start.ts",
        "/root": "/db-explorer-root.tsx",
        "/page": "/db-explorer-page.tsx",
      };
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.includes("html-proxy")) {
          const originalEnd = res.end.bind(res);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (res as any).end = (chunk: any, ...args: any[]) => {
            const content = chunk?.toString?.() ?? chunk;
            if (typeof content === "string") {
              return originalEnd(
                content
                  .replace(/from\s+["']\/db-explorer-start\.ts["']/g, 'from "/start"')
                  .replace(/from\s+["']\/db-explorer-root\.tsx["']/g, 'from "/root"')
                  .replace(/from\s+["']\/db-explorer-page\.tsx["']/g, 'from "/page"'),
                ...args
              );
            }
            return originalEnd(chunk, ...args);
          };
        }
        if (req.url === "/" || req.url === "/index.html") {
          const { DBExplorerPage } = await server.ssrLoadModule("/db-explorer-page.tsx");
          const { renderToStaticMarkup } = await import("react-dom/server");
          const { default: React } = await import("react");
          const html = renderToStaticMarkup(
            React.createElement(DBExplorerPage, {
              importMap: { imports: { "@vibes.diy/vibe-db-explorer/start": "/start" } },
              base: "/",
            })
          );
          const transformed = await server.transformIndexHtml(req.url, "<!doctype html>" + html);
          res.setHeader("Content-Type", "text/html");
          res.end(transformed);
          return;
        }
        const target = req.url && map[req.url];
        if (target) {
          const result = await server.transformRequest(target);
          if (result) {
            res.setHeader("Content-Type", "application/javascript");
            res.end(result.code);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), entryAliasPlugin()],
  server: { port: 5199 },
  build: {
    outDir: "dist",
    // rollupOptions: {
    //   output: {
    //     manualChunks: {
    //       "ag-grid": ["ag-grid-community", "ag-grid-react"],
    //     },
    //   },
    // },
  },
});
