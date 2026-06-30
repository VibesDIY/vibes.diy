// Generator for the SSR isolate dependency bundle (#2845 cb2).
//
// The Cloudflare Worker Loader instantiates an isolate from a flat `modules` map
// and does NOT resolve npm specifiers. So before a vibe can be server-rendered in
// a real isolate, every dependency the generated `main`/vibe modules import —
// `@vibes.diy/vibe-runtime/render-vibes.js` (which pulls react-dom/server +
// arktype) and the `react` / `react/jsx-runtime` the vibe imports — must be
// pre-bundled into entries the map can carry.
//
// Design — ONE inlined React instance:
//   * `@vibes.diy/vibe-runtime/render-vibes.js` is one self-contained esbuild
//     bundle: render-vibes + react-dom/server + arktype + React, all inlined. It
//     ALSO re-exports React's named exports and jsx/jsxs, so the React it renders
//     with IS the only React instance.
//   * the `react` and `react/jsx-runtime` map entries are thin shims that
//     re-export (by explicit name) from that single bundle.
// Every cross-module edge is therefore a BARE-specifier lookup against a map key
// (no relative-chunk paths, whose Worker-Loader resolution semantics differ), and
// the vibe's hooks share the exact React instance react-dom/server renders with —
// the hydration-parity prerequisite. `export *` is avoided deliberately: it does
// not surface React's CJS named exports (`useState`, `Fragment`, …) as static ESM
// bindings, so the names are enumerated from the installed React at build time.
//
// Run directly (`node scripts/build-ssr-isolate-deps.mjs`) it writes the
// gitignored `ssr-isolate-deps.generated.js`. Imported, `buildSsrIsolateDepModules`
// returns the same modules in-memory (used by the render test, so the test never
// depends on a built artifact).

import esbuild from "esbuild";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";

const RUNTIME_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Resolve React et al. from the runtime package's own node_modules — the same
// instance render-vibes.ts compiles against.
const requireFromRuntime = createRequire(resolve(RUNTIME_DIR, "render-vibes.ts"));

// The three map keys the isolate imports. Exact specifiers, so the modules map is
// a pure key→source lookup.
export const RENDER_VIBES_KEY = "@vibes.diy/vibe-runtime/render-vibes.js";
export const REACT_KEY = "react";
export const JSX_RUNTIME_KEY = "react/jsx-runtime";

// react/jsx-runtime's runtime surface (production runtime; jsxDEV lives in the
// separate dev runtime, which production JSX never imports).
const JSX_RUNTIME_EXPORTS = ["jsx", "jsxs", "Fragment"];

const VALID_EXPORT_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

async function bundleSingleModule(facadeSource) {
  const out = await esbuild.build({
    absWorkingDir: RUNTIME_DIR,
    stdin: { contents: facadeSource, resolveDir: RUNTIME_DIR, sourcefile: "ssr-isolate-facade.js", loader: "js" },
    bundle: true,
    format: "esm",
    // Match the Worker Loader isolate target (Web-standard runtime, not Node).
    platform: "browser",
    conditions: ["worker", "browser", "import"],
    minify: true,
    legalComments: "none",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    write: false,
  });
  return out.outputFiles[0].text;
}

export async function buildSsrIsolateDepModules() {
  const reactExportNames = Object.keys(requireFromRuntime("react")).filter((k) => VALID_EXPORT_NAME.test(k));

  // The single bundle: inline render-vibes + React + jsx-runtime, and re-export
  // everything the shims (and any vibe) need from this one inlined instance.
  const facade = [
    `export { renderVibeToString } from "./render-vibes.js";`,
    `import __React from "react";`,
    `export default __React;`,
    ...reactExportNames.map((name) => `export const ${name} = __React[${JSON.stringify(name)}];`),
    `import { jsx as __jsx, jsxs as __jsxs } from "react/jsx-runtime";`,
    `export const jsx = __jsx;`,
    `export const jsxs = __jsxs;`,
  ].join("\n");

  const renderVibesBundle = await bundleSingleModule(facade);

  // Shims: explicit named re-exports from the single bundle (NOT `export *`, which
  // drops React's CJS names). `Fragment` comes through React's export set.
  const reactShim = `export { default, ${reactExportNames.join(", ")} } from ${JSON.stringify(RENDER_VIBES_KEY)};\n`;
  const jsxRuntimeShim = `export { ${JSX_RUNTIME_EXPORTS.join(", ")} } from ${JSON.stringify(RENDER_VIBES_KEY)};\n`;

  const modules = {
    [RENDER_VIBES_KEY]: renderVibesBundle,
    [REACT_KEY]: reactShim,
    [JSX_RUNTIME_KEY]: jsxRuntimeShim,
  };

  // Content digest over ALL dep module sources (sorted keys for determinism).
  // Folded into the isolate cache key so ANY change to the bundled runtime —
  // render-vibes, react-dom/server, arktype, the shims — re-keys the isolate,
  // not just a React version bump (per Codex P2 on #2967). The React version
  // alone is insufficient: a dep change at the same React version would otherwise
  // reuse an isolate built from the stale bundle after a deploy.
  const digest = createHash("sha256");
  for (const key of Object.keys(modules).sort()) {
    digest.update(key);
    digest.update("\0");
    digest.update(modules[key]);
    digest.update("\0");
  }

  return {
    reactVersion: requireFromRuntime("react/package.json").version,
    depsVersion: digest.digest("hex").slice(0, 16),
    modules,
  };
}

// Direct invocation → write the gitignored artifact the live executor imports.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { modules, reactVersion, depsVersion } = await buildSsrIsolateDepModules();
  const bytes = Object.values(modules).reduce((n, s) => n + s.length, 0);
  const artifact =
    `// @generated by vibe/runtime/scripts/build-ssr-isolate-deps.mjs — DO NOT EDIT.\n` +
    `// Pre-bundled SSR isolate dependency modules for the Cloudflare Worker Loader\n` +
    `// modules map (#2845 cb2). Regenerate with: pnpm --filter @vibes.diy/vibe-runtime run gen:ssr-deps\n` +
    `export const SSR_ISOLATE_REACT_VERSION = ${JSON.stringify(reactVersion)};\n` +
    `export const SSR_ISOLATE_DEPS_VERSION = ${JSON.stringify(depsVersion)};\n` +
    `export const SSR_ISOLATE_DEP_MODULES = ${JSON.stringify(modules)};\n`;
  await writeFile(resolve(RUNTIME_DIR, "ssr-isolate-deps.generated.js"), artifact);
  // eslint-disable-next-line no-console
  console.log(
    `Wrote ssr-isolate-deps.generated.js — React ${reactVersion}, deps ${depsVersion}, ${Object.keys(modules).length} modules, ${(bytes / 1024).toFixed(0)}KB`
  );
}
