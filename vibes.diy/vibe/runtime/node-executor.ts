import { type FunctionComponent } from "react";
import { exception2Result } from "@adviser/cement";
import { init as initLexer, parse as parseModule } from "es-module-lexer";
import { renderVibeToString } from "./render-vibes.js";
import { transformVibeSource } from "./transform-vibe-source.js";
import { type Executor, type VibeExecuteInput, type VibeExecuteResult } from "./vibe-executor.js";

// A specifier that already resolves on its own — relative, absolute, or carrying
// a scheme (`http:`, `file:`, `node:`, `data:`). Only bare names need resolving.
const ALREADY_RESOLVED = /^(?:\.\.?\/|\/|[a-z][a-z0-9+.-]*:)/i;

/**
 * Rewrite the compiled module's bare specifiers (`react`, `react/jsx-runtime`,
 * …) to absolute `file://` URLs resolved against the runtime package's own
 * node_modules. A `data:` URL module has no parent path, so Node can't resolve
 * bare specifiers from it; resolving here also keeps a SINGLE React instance
 * shared with `react-dom/server`, which is what makes the SSR markup match what
 * the client hydrates.
 *
 * Import positions come from `es-module-lexer` (the same lexer Vite/Rollup use),
 * not a hand-rolled scanner: it finds every static `import`/`export … from`
 * specifier anywhere in the module — including after a `"use client"` directive
 * or other top-level statements (Sucrase does NOT hoist imports), and through a
 * comment between `import` and its clause — while ignoring import-looking text
 * inside string/template literals and comments. Dynamic `import(...)` is flagged
 * (`d > -1`) and left untouched. (Per @CharlieHelps review: a leading-run
 * scanner missed these valid forms and left `react` bare → SSR failure.)
 *
 * Slice 2 resolves what `import.meta.resolve` can reach (React + anything in the
 * package's dependency tree). Full vibe dependency-graph / import-map resolution
 * is a later slice; an unresolvable bare specifier is left untouched, so it
 * throws at import time with a clear message rather than silently mis-resolving.
 */
async function resolveBareSpecifiers(code: string, resolve: (spec: string) => string): Promise<string> {
  await initLexer;
  const [imports] = parseModule(code);
  let out = "";
  let last = 0;
  for (const imp of imports) {
    if (imp.d > -1) continue; // dynamic import() / import.meta — leave untouched
    if (imp.s < 0) continue; // no static specifier span
    const spec = code.slice(imp.s, imp.e); // specifier text, without quotes
    if (ALREADY_RESOLVED.test(spec)) continue;
    const resolved = exception2Result(() => resolve(spec)); // rules-bag: no bare try/catch
    if (resolved.isErr()) continue; // unresolved → leave bare, clear error at import time
    out += code.slice(last, imp.s) + resolved.Ok();
    last = imp.e;
  }
  out += code.slice(last);
  return out;
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
    const resolved = await resolveBareSpecifiers(module, (spec) => import.meta.resolve(spec));
    const dataUrl = "data:text/javascript;base64," + Buffer.from(resolved, "utf8").toString("base64");

    const mod = (await import(/* @vite-ignore */ dataUrl)) as { default?: unknown };
    const App = mod.default;
    if (typeof App !== "function") {
      throw new Error("vibe module has no default-exported component");
    }
    return { html: renderVibeToString([App as FunctionComponent], input.mountParams) };
  }
}
