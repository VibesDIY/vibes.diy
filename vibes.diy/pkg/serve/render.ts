import { renderToString } from "react-dom/server";
import React from "react";
import { build } from "esbuild-wasm";
import type { MountVibeParams } from "@vibes.diy/use-vibes-base";
import { pathOps } from "@adviser/cement";

export interface VibesDiyServCtx {
  readonly versions: { readonly FP: string };
  readonly vibesCtx: MountVibeParams;
  loadFile(file: string): Promise<string | undefined>;
  loadFileBinary(file: string): Promise<Uint8Array | undefined>;
  readonly basePath: string;
  readonly isSession: boolean;
  readonly transformedJS: string;
  // [key: string]: unknown;
}

export async function buildMountedApp(
  ctx: MountVibeParams,
  code: string,
): Promise<string> {
  let mountVibeImport = "/dist/vibes.diy/pkg/serve/mount-vibe.js";
  if (ctx.env.LOCAL_SERVE) {
    mountVibeImport = pathOps.join(ctx.env.LOCAL_SERVE, mountVibeImport);
  }
  const result = await build({
    stdin: {
      contents: `
        import { mountVibe } from '${mountVibeImport}';
        import vibe from '~transform-with-esbuild-use-code-provided';
        mountVibe(vibe, ${JSON.stringify(ctx)});
      `,
      loader: "ts",
      resolveDir: ".",
    },
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
    target: "es2020",
    plugins: [
      {
        name: "vibe-code-injector",
        setup(build) {
          // Intercept the special import marker
          build.onResolve(
            { filter: /^~transform-with-esbuild-use-code-provided$/ },
            (args) => ({
              path: args.path,
              namespace: "vibe-code",
            }),
          );

          // Return the provided vibe code for the special import
          build.onLoad({ filter: /.*/, namespace: "vibe-code" }, () => ({
            contents: code,
            loader: "jsx",
          }));

          // Make all other imports external (don't bundle them)
          build.onResolve({ filter: /.*/ }, (args) => {
            // Skip stdin and the special marker
            if (args.kind === "entry-point") return;
            if (
              args.path.startsWith("~transform-with-esbuild-use-code-provided")
            )
              return;

            // External imports
            return {
              path: args.path,
              external: true,
            };
          });
        },
      },
    ],
  });
  const transformed = new TextDecoder().decode(result.outputFiles[0].contents);
  return transformed;
}

export async function loadAndRenderTSX(
  filePath: string,
  ctx: VibesDiyServCtx,
): Promise<string> {
  try {
    // Read the TSX file
    console.log("loadAndRenderTSX filePath:", filePath);
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
