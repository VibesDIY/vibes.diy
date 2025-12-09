import { renderToString } from "react-dom/server";
import React from "react";
import { contentType } from "mime-types";

// Simple in-memory module cache
const moduleCache = new Map();

async function loadAndRenderTSX(filePath: string): Promise<string> {
  try {
    // Read the TSX file
    const code = await Deno.readTextFile(filePath);

    // Check cache
    const cacheKey = `${filePath}:${code}`;
    if (moduleCache.has(cacheKey)) {
      const Component = moduleCache.get(cacheKey);
      return renderToString(React.createElement(Component));
    }

    // Transform TSX to JS using esbuild
    const { build } = await import("esbuild");

    const result = await build({
      stdin: {
        contents: code,
        loader: "tsx",
        resolveDir: Deno.cwd(),
      },
      bundle: true,
      format: "esm",
      jsx: "automatic",
      write: false,
      platform: "neutral",
    });

    const transformed = new TextDecoder().decode(
      result.outputFiles[0].contents,
    );
    // console.log(transformed);

    // Create a data URL module
    const dataUrl = `data:text/javascript;base64,${btoa(transformed)}`;
    const module = await import(dataUrl);

    // Get the default export (should be the component)
    const Component = module.default;

    // Cache it
    moduleCache.set(cacheKey, Component);

    // Render to HTML string
    const html = renderToString(React.createElement(Component));

    return html;
  } catch (error) {
    throw new Error(`Failed to render TSX: ${(error as Error).message}`);
  }
}

Deno.serve({ port: 8001 }, async (req) => {
  const url = new URL(req.url);
  const requestedPath = url.pathname;

  // Map request path to local filesystem
  const cwd = Deno.cwd();
  const localPath = `${cwd}${requestedPath}`;

  // First, try to serve static file from disk
  try {
    const fileInfo = await Deno.stat(localPath);

    if (fileInfo.isFile) {
      const content = await Deno.readFile(localPath);
      const ext = requestedPath.substring(requestedPath.lastIndexOf("."));
      const mimeType = contentType(ext) || "application/octet-stream";

      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch (_error) {
    // File not found, continue to TSX rendering
  }

  // If no static file found, render index.tsx
  try {
    const indexPath = `${cwd}/index.tsx`;
    const html = await loadAndRenderTSX(indexPath);

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

console.log("TSX render server running on http://localhost:8001");
console.log("Usage: http://localhost:8001?file=/path/to/component.tsx");
