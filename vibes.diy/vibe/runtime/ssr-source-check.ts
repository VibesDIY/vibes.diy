import { init as initLexer, parse as parseModule } from "es-module-lexer";
import { transformVibeSource } from "./transform-vibe-source.js";

/**
 * Does this vibe source statically import a sibling file (`./Badge.jsx`,
 * `../lib/x.js`)? (#2802 slice 4.)
 *
 * The caller uses this to route: no relative imports → render the single entry
 * directly; a relative import → resolve the whole module graph and SSR it
 * (`resolveVibeModuleGraph`, #2845 cb6). Only a graph that fails to resolve (a
 * broken/missing sibling) falls back to client-only (`relative_import_unsupported`).
 *
 * `es-module-lexer` can't parse JSX, so we transform to JS first (the same
 * Sucrase pass the executor runs) and lex the compiled module. Dynamic
 * `import(...)` is ignored (`d > -1`) — only static relative specifiers count.
 * Server-only: kept off the client entry (it pulls `es-module-lexer`).
 */
export async function hasRelativeImports(source: string): Promise<boolean> {
  const { module } = transformVibeSource(source);
  await initLexer;
  const [imports] = parseModule(module);
  return imports.some((imp) => imp.d === -1 && imp.n !== undefined && /^\.\.?\//.test(imp.n));
}
