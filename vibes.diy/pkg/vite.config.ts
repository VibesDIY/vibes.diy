// import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import type { ConfigEnv, UserConfig, Plugin } from "vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// import { cloudflare } from "@cloudflare/vite-plugin";

// Plugin to move importmap to the beginning of <head>
function moveImportmapFirst(): Plugin {
  return {
    name: "move-importmap-first",
    enforce: "post",
    async closeBundle() {
      // Post-process the generated HTML file
      const fs = await import("fs/promises");
      const path = await import("path");
      const htmlPath = path.join(
        process.cwd(),
        "build",
        "client",
        "index.html",
      );

      try {
        let html = await fs.readFile(htmlPath, "utf-8");

        // Find the importmap script
        const importmapRegex =
          /<script type="importmap"[^>]*>[\s\S]*?<\/script>/;
        const importmapMatch = html.match(importmapRegex);

        if (!importmapMatch) {
          return;
        }

        const importmapScript = importmapMatch[0];

        // Remove the importmap from its current position
        html = html.replace(importmapRegex, "");

        // Insert it right after <head>
        html = html.replace(/<head>/, `<head>${importmapScript}`);

        await fs.writeFile(htmlPath, html, "utf-8");
      } catch (error) {
        // Silently ignore - file doesn't exist in all build environments
      }
    },
  };
}

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  // Disable React Router plugin for tests or when explicitly disabled
  const disableReactRouter =
    mode === "test" || process.env.DISABLE_REACT_ROUTER === "true";
  console.log("disableReactRouter", disableReactRouter);

  return {
    plugins: [
      tailwindcss(),
      // Only include React Router plugin when not disabled
      tsconfigPaths({
        configNames: ["tsconfig.dev.json"],
      }),

      {
        name: "preserve-imports",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const originalWrite = res.write;
            const originalEnd = res.end;
            const chunks: Buffer[] = [];

            // @ts-ignore
            res.write = function (chunk: any, ...args: any[]) {
              chunks.push(Buffer.from(chunk));
              // @ts-ignore
              return originalWrite.apply(res, [chunk, ...args]);
            };

            // @ts-ignore
            res.end = function (chunk: any, ...args: any[]) {
              if (chunk) {
                chunks.push(Buffer.from(chunk));
              }

              const body = Buffer.concat(chunks).toString("utf8");

              // Only transform JS files
              if (req.url?.endsWith(".js") && body.includes('from "/@fs/')) {
                // Replace resolved paths back to bare specifiers
                const transformed = body.replace(
                  /from\s+"\/@fs\/[^"]+\/node_modules\/\.pnpm\/([^@\/]+)@[^\/]+\/node_modules\/\1[^"]*"/g,
                  'from "$1"',
                );

                console.log("Middleware transformed:", req.url);

                // Clear chunks and write transformed content
                res.removeHeader("Content-Length");
                // @ts-ignore
                return originalEnd.call(res, transformed, ...args);
              }

              // @ts-ignore
              return originalEnd.apply(res, [chunk, ...args]);
            };

            next();
          });
        },
      },

      //      cloudflare(),
      // ...(!disableReactRouter ? [reactRouter({ ssr: false })] : []),
      // moveImportmapFirst(),
    ],
    base: process.env.VITE_APP_BASENAME || "/",
    /*
    ssr: {
      external: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "use-vibes",
      ],
    },
    build: {
      outDir: "build",
      rollupOptions: {
        external: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
          "use-vibes",
          "use-fireproof",
        ],
      },
    },
*/
    build: {
      sourcemap: false, // Disable sourcemap generation
    },
    optimizeDeps: {
      disabled: true, // Disable all pre-bundling
    },
    // Define global constants
    // define: {
    //   IFRAME__CALLAI_API_KEY: JSON.stringify(env.VITE_OPENROUTER_API_KEY),
    // },
    // Server configuration for local development

    server: {
      host: "0.0.0.0", // Listen on all local IPs
      port: 8888,
      allowedHosts: ["devserver-main--fireproof-ai-builder.netlify.app"], // Specific ngrok hostname
      cors: true, // Enable CORS for all origins
      hmr: {
        overlay: false, // Disable HMR overlay
      },
      // Ignore test directory changes to prevent unnecessary reloads during development
      watch: {
        ignored: ["**/tests/**"],
      },
    },
    // Ensure JSON imports are properly handled
    json: {
      stringify: true,
    },
  };
});
