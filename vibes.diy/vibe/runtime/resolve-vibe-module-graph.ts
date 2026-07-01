import { init as initLexer, parse as parseModule } from "es-module-lexer";
import { transformVibeSource } from "./transform-vibe-source.js";

/**
 * Resolve a vibe's relative-import graph into a flat, transformed module map the
 * Cloudflare Worker Loader can carry (#2845 cb6 — multi-file vibe SSR).
 *
 * A vibe whose `App.jsx` imports sibling files (`./Badge.jsx`, `./lib/util.js`)
 * used to fall back to client-only (`relative_import_unsupported`), because the
 * isolate `modules` map only carried the single entry. Here we walk the graph:
 * transform each module (the same Sucrase pass the executor runs), find its
 * **relative** static imports, rewrite each specifier to the imported module's
 * modules-map key, and collect every reachable module. Bare specifiers
 * (`react`, `react/jsx-runtime`, …) are left untouched — they resolve to the
 * pre-bundled dep modules. The isolate then resolves `./Badge.js` against the
 * importer's key exactly as an ES module graph would.
 *
 * Pure + Workers-safe (Sucrase + es-module-lexer, no wasm/eval), and injected
 * with `resolveSibling` so it needs no filesystem knowledge — the caller
 * (`attemptVibeSsr`) backs it with the vibe's `fsItems`. Kept off the client
 * entry (it pulls `es-module-lexer`).
 */

/** A vibe source module: its vibe-absolute path (e.g. `/App.jsx`) + raw TSX/JSX. */
export interface ResolvedVibeModule {
  readonly path: string;
  readonly source: string;
}

export interface VibeModuleGraph {
  /** Modules-map key of the entry module (what `main` imports). */
  readonly entryKey: string;
  /** Modules-map key → transformed ESM source (relative specifiers rewritten to keys). */
  readonly modules: Record<string, string>;
}

/** Resolve `specifier` (relative) imported from `fromPath` to a sibling module, or null if it does not exist. */
export type ResolveSibling = (fromPath: string, specifier: string) => Promise<ResolvedVibeModule | null>;

const RELATIVE = /^\.\.?\//;

/**
 * Modules-map key for a vibe path: leading slashes stripped, source extension
 * normalized to `.js` (Sucrase emits JS). `/App.jsx` → `App.js`,
 * `/lib/util.tsx` → `lib/util.js`.
 */
function moduleKey(vibePath: string): string {
  const p = vibePath.replace(/^\/+/, "");
  if (/\.(jsx|tsx|ts|mjs|cjs)$/i.test(p)) return p.replace(/\.(jsx|tsx|ts|mjs|cjs)$/i, ".js");
  if (/\.js$/i.test(p)) return p;
  return `${p}.js`;
}

/** Relative specifier from `fromKey`'s directory to `toKey` (both root-relative keys). */
function relativeSpecifier(fromKey: string, toKey: string): string {
  const fromDir = fromKey.split("/").slice(0, -1);
  const to = toKey.split("/");
  let i = 0;
  while (i < fromDir.length && i < to.length - 1 && fromDir[i] === to[i]) i++;
  const up = fromDir.length - i;
  const rel = [...Array(up).fill(".."), ...to.slice(i)].join("/");
  return RELATIVE.test(rel) ? rel : `./${rel}`;
}

export async function resolveVibeModuleGraph(entry: ResolvedVibeModule, resolveSibling: ResolveSibling): Promise<VibeModuleGraph> {
  await initLexer;
  const modules: Record<string, string> = {};
  const seen = new Set<string>();
  const queue: ResolvedVibeModule[] = [entry];

  while (queue.length > 0) {
    const mod = queue.shift() as ResolvedVibeModule;
    if (seen.has(mod.path)) continue;
    seen.add(mod.path);
    const key = moduleKey(mod.path);

    const { module: js } = transformVibeSource(mod.source);
    const [imports] = parseModule(js);
    let out = "";
    let last = 0;
    for (const imp of imports) {
      if (imp.d !== -1) continue; // dynamic import() — leave untouched
      if (imp.s < 0) continue; // no static specifier span
      const spec = js.slice(imp.s, imp.e); // specifier without quotes
      if (!RELATIVE.test(spec)) continue; // bare specifier (react, …) → dep modules
      const sibling = await resolveSibling(mod.path, spec);
      if (sibling === null) {
        // A relative import that resolves to nothing is a broken graph — bail so
        // the caller falls back to client-only rather than shipping an isolate
        // that throws at import time.
        throw new Error(`unresolved relative import "${spec}" from ${mod.path}`);
      }
      out += js.slice(last, imp.s) + relativeSpecifier(key, moduleKey(sibling.path));
      last = imp.e;
      if (!seen.has(sibling.path)) queue.push(sibling);
    }
    out += js.slice(last);
    modules[key] = out;
  }

  return { entryKey: moduleKey(entry.path), modules };
}
