import { renderToString } from "react-dom/server";
import React from "react";
import { build } from "esbuild";

export interface VibesDiyServCtx {
  readonly versions: { readonly FP: string };
  loadFile(file: string): Promise<string|undefined>;
  basePath: string;
  [key: string]: unknown;
}

export async function loadAndRenderTSX(
  filePath: string,
  ctx: VibesDiyServCtx, 
): Promise<string> {
  try {
    // Read the TSX file
    const code = await ctx.loadFile(filePath);
    if (!code) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Transform TSX to JS using esbuild

    const result = await build({
      stdin: {
        contents: code,
        loader: "tsx",
        resolveDir: ctx.basePath,
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
    return await renderScript(transformed, ctx);
  } catch (error) {
    throw new Error(
      `Failed to load and render TSX: ${(error as Error).message}`,
    );
  }
}

export async function renderScript(
  script: string,
  ctx: VibesDiyServCtx,
): Promise<string> {
  // Create a data URL module
  const dataUrl = `data:text/javascript;base64,${btoa(script)}`;
  const module = await import(dataUrl);

  // Get the default export (should be the component)
  const Component = module.default;

  // Render to HTML string
  const html = renderToString(React.createElement(Component, ctx));

  return html;
}

export async function loadAndRenderJSX(code: string): Promise<string> {
  try {
    // Check cache

    // Transform JSX to JS using esbuild - externalize all imports

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

    return transformed; // Return transformed JS, not rendered HTML
  } catch (error) {
    throw new Error(`Failed to transform JSX: ${(error as Error).message}`);
  }
}
