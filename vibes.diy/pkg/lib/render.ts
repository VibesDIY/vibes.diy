import { renderToString } from "react-dom/server";
import React from "react";
import { build } from "esbuild";

export async function loadAndRenderTSX(
  filePath: string,
  props?: Record<string, unknown>,
): Promise<string> {
  try {
    // Read the TSX file
    const code = await Deno.readTextFile(filePath);

    // Transform TSX to JS using esbuild

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
    return await renderScript(transformed, props);
  } catch (error) {
    throw new Error(
      `Failed to load and render TSX: ${(error as Error).message}`,
    );
  }
}

export async function renderScript(
  script: string,
  props?: Record<string, unknown>,
): Promise<string> {
  // Create a data URL module
  const dataUrl = `data:text/javascript;base64,${btoa(script)}`;
  const module = await import(dataUrl);

  // Get the default export (should be the component)
  const Component = module.default;

  // Render to HTML string
  const html = renderToString(React.createElement(Component, props));

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
