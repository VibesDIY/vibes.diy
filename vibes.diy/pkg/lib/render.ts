import { renderToString } from "react-dom/server";
import React from "react";

// Simple in-memory module cache
const moduleCache = new Map();

export async function loadAndRenderTSX(
  filePath: string,
  props?: Record<string, unknown>,
): Promise<string> {
  try {
    // Read the TSX file
    const code = await Deno.readTextFile(filePath);

    // Check cache (include props in cache key if provided)
    const cacheKey = props
      ? `${filePath}:${code}:${JSON.stringify(props)}`
      : `${filePath}:${code}`;
    if (moduleCache.has(cacheKey)) {
      const Component = moduleCache.get(cacheKey);
      return renderToString(React.createElement(Component, props));
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

    // Create a data URL module
    const dataUrl = `data:text/javascript;base64,${btoa(transformed)}`;
    const module = await import(dataUrl);

    // Get the default export (should be the component)
    const Component = module.default;

    // Cache it
    moduleCache.set(cacheKey, Component);

    // Render to HTML string
    const html = renderToString(React.createElement(Component, props));

    return html;
  } catch (error) {
    throw new Error(`Failed to render TSX: ${(error as Error).message}`);
  }
}

export async function loadAndRenderJSX(code: string): Promise<string> {
  try {
    // Check cache
    const cacheKey = `jsx:${code}`;
    if (moduleCache.has(cacheKey)) {
      return moduleCache.get(cacheKey);
    }

    // Transform JSX to JS using esbuild - externalize all imports
    const { build } = await import("esbuild");

    const result = await build({
      stdin: {
        contents: code,
        loader: "jsx",
      },
      bundle: false, // Don't bundle - keep imports external
      format: "esm",
      jsx: "automatic",
      write: false,
      platform: "browser",
    });

    const transformed = new TextDecoder().decode(
      result.outputFiles[0].contents,
    );

    // Cache the transformed JS
    moduleCache.set(cacheKey, transformed);

    return transformed; // Return transformed JS, not rendered HTML
  } catch (error) {
    throw new Error(`Failed to transform JSX: ${(error as Error).message}`);
  }
}
