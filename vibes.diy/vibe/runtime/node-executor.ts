import { type FunctionComponent } from "react";
import { exception2Result } from "@adviser/cement";
import { renderVibeToString } from "./render-vibes.js";
import { transformVibeSource } from "./transform-vibe-source.js";
import { type Executor, type VibeExecuteInput, type VibeExecuteResult } from "./vibe-executor.js";

// A specifier that already resolves on its own — relative, absolute, or carrying
// a scheme (`http:`, `file:`, `node:`, `data:`). Only bare names need resolving.
const ALREADY_RESOLVED = /^(?:\.\.?\/|\/|[a-z][a-z0-9+.-]*:)/i;

// True when an `import` *declaration* (static import/side-effect import) begins
// at `i` — as opposed to a dynamic `import(...)` call or an identifier that
// merely starts with "import". A declaration continues (after optional
// whitespace) with a clause opener `{ * " '` or a binding identifier; a dynamic
// import continues with `(`, which is excluded so `import("x")` / `import ("x")`
// are left untouched.
function isImportDeclAt(code: string, i: number): boolean {
  if (code.slice(i, i + 6) !== "import") return false;
  const n = code.length;
  let j = i + 6;
  if (j < n && /[A-Za-z0-9_$]/.test(code[j])) return false; // "importFoo"
  while (j < n && /\s/.test(code[j])) j++;
  const c = code[j];
  return c === "{" || c === "*" || c === '"' || c === "'" || /[A-Za-z_$]/.test(c ?? "");
}

// Advance past whitespace, line/block comments, and `;` statement separators
// between top-level statements. Used only between import declarations, never
// inside one — so it can't skip over module-body content.
function skipSeparators(code: string, i: number): number {
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === ";") {
      i++;
    } else if (code.startsWith("//", i)) {
      const nl = code.indexOf("\n", i);
      i = nl === -1 ? n : nl + 1;
    } else if (code.startsWith("/*", i)) {
      const end = code.indexOf("*/", i);
      i = end === -1 ? n : end + 2;
    } else {
      break;
    }
  }
  return i;
}

/**
 * Rewrite the compiled module's bare specifiers (`react`, `react/jsx-runtime`,
 * …) to absolute `file://` URLs resolved against the runtime package's own
 * node_modules. A `data:` URL module has no parent path, so Node can't resolve
 * bare specifiers from it; resolving here also keeps a SINGLE React instance
 * shared with `react-dom/server`, which is what makes the SSR markup match what
 * the client hydrates.
 *
 * Only the leading run of `import` declarations is rewritten — a small scanner
 * walks them and rewrites each statement's module specifier in place, stopping
 * at the first non-import statement. This deliberately never touches the module
 * body, so import-looking text inside a string/template a vibe renders (e.g.
 * `'import x from "react"'`) is left verbatim rather than corrupted.
 *
 * Slice 2 resolves what `import.meta.resolve` can reach (React + anything in the
 * package's dependency tree). Full vibe dependency-graph / import-map resolution
 * is a later slice; an unresolvable bare specifier is left untouched, so it
 * throws at import time with a clear message rather than silently mis-resolving.
 */
function resolveBareSpecifiers(code: string, resolve: (spec: string) => string): string {
  const rewriteSpec = (spec: string): string => {
    if (ALREADY_RESOLVED.test(spec)) return spec;
    // rules-bag: no bare try/catch — wrap the throwing resolver in a Result.
    const resolved = exception2Result(() => resolve(spec));
    return resolved.isOk() ? resolved.Ok() : spec; // unresolved → clear error at import time
  };

  const n = code.length;
  let i = 0;
  let out = "";
  for (;;) {
    const sepStart = i;
    i = skipSeparators(code, i);
    out += code.slice(sepStart, i); // copy whitespace/comments/`;` verbatim
    if (i >= n || isImportDeclAt(code, i) === false) {
      out += code.slice(i); // module body — never rewritten
      break;
    }
    // The only string literal in an import declaration is its module specifier,
    // so the first quote after the keyword opens it and the declaration ends at
    // its closing quote.
    const dq = code.indexOf('"', i);
    const sq = code.indexOf("'", i);
    const q = dq === -1 ? sq : sq === -1 ? dq : Math.min(dq, sq);
    if (q === -1) {
      out += code.slice(i);
      break;
    }
    const quote = code[q];
    const qe = code.indexOf(quote, q + 1);
    if (qe === -1) {
      out += code.slice(i);
      break;
    }
    out += code.slice(i, q + 1); // import head + opening quote
    out += rewriteSpec(code.slice(q + 1, qe)); // resolved (or untouched) specifier
    out += quote; // closing quote
    i = qe + 1;
  }
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
