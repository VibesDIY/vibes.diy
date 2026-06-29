import { type FunctionComponent } from "react";
import { renderVibeToString } from "./render-vibes.js";
import { transformVibeSource } from "./transform-vibe-source.js";
import { type Executor, type VibeExecuteInput, type VibeExecuteResult } from "./vibe-executor.js";

// A specifier that already resolves on its own — relative, absolute, or carrying
// a scheme (`http:`, `file:`, `node:`, `data:`). Only bare names need resolving.
const ALREADY_RESOLVED = /^(?:\.\.?\/|\/|[a-z][a-z0-9+.-]*:)/i;

// `import … from "x"` / `export … from "x"` specifiers. The `[^"';]*?` between
// the keyword and `from` keeps the match inside one import/export statement, so
// it can't wander into the module body. Sucrase emits double quotes, but we
// accept single too for safety.
const FROM_SPECIFIER = /\b(?:import|export)\b[^"';]*?\bfrom\s*(["'])([^"']+)\1/g;
// Side-effect `import "x"`. The space-or-nothing before the quote excludes
// dynamic `import("x")` (next char is `(`, not a quote).
const SIDE_EFFECT_IMPORT = /\bimport\s*(["'])([^"']+)\1/g;

/**
 * Rewrite the compiled module's bare specifiers (`react`, `react/jsx-runtime`,
 * …) to absolute `file://` URLs resolved against the runtime package's own
 * node_modules. A `data:` URL module has no parent path, so Node can't resolve
 * bare specifiers from it; resolving here also keeps a SINGLE React instance
 * shared with `react-dom/server`, which is what makes the SSR markup match what
 * the client hydrates.
 *
 * Slice 2 resolves what `import.meta.resolve` can reach (React + anything in the
 * package's dependency tree). Full vibe dependency-graph / import-map resolution
 * is a later slice; an unresolvable bare specifier is left untouched, so it
 * throws at import time with a clear message rather than silently mis-resolving.
 */
function resolveBareSpecifiers(code: string, resolve: (spec: string) => string): string {
  const rewriteSpec = (match: string, quote: string, spec: string): string => {
    if (ALREADY_RESOLVED.test(spec)) return match;
    try {
      return match.replace(`${quote}${spec}${quote}`, `${quote}${resolve(spec)}${quote}`);
    } catch {
      return match; // leave it — surfaces as a clear resolution error at import time
    }
  };
  return code
    .replace(FROM_SPECIFIER, (m, q, spec) => rewriteSpec(m, q, spec))
    .replace(SIDE_EFFECT_IMPORT, (m, q, spec) => rewriteSpec(m, q, spec));
}

/**
 * Runs a freshly-compiled vibe module in THIS process and renders it (#2802,
 * slice 2). This is the CI-testable executor and the Node/Deno container
 * fallback. The edge counterpart is `WorkerLoaderExecutor`.
 *
 * Pipeline: `transformVibeSource` → resolve bare specifiers → dynamic-`import` a
 * `data:` URL → take the default export as the vibe component → slice-1
 * `renderVibeToString`.
 */
export class NodeExecutor implements Executor {
  async render(input: VibeExecuteInput): Promise<VibeExecuteResult> {
    const { module } = transformVibeSource(input.source);
    const resolved = resolveBareSpecifiers(module, (spec) => import.meta.resolve(spec));
    const dataUrl = "data:text/javascript;base64," + Buffer.from(resolved, "utf8").toString("base64");

    const mod = (await import(/* @vite-ignore */ dataUrl)) as { default?: unknown };
    const App = mod.default;
    if (typeof App !== "function") {
      throw new Error("vibe module has no default-exported component");
    }
    return { html: renderVibeToString([App as FunctionComponent], input.mountParams) };
  }
}
