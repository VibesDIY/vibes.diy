import { init as initLexer, parse as parseModule } from "es-module-lexer";
import { transformVibeSource } from "./transform-vibe-source.js";

/**
 * Does this vibe source statically import a sibling file (`./Badge.jsx`,
 * `../lib/x.js`)? (#2802 slice 4.)
 *
 * Slice-4 SSR renders **single-file entries** only; a relative import means
 * sibling modules the executor can't resolve yet (the relative / full
 * dependency-graph resolution slice 2 deferred), so the caller falls back to
 * client-only rendering with reason `relative_import_unsupported` rather than
 * SSR-ing a tree that would mismatch on hydrate.
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
