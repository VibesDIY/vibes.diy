// Hot-swap fallback resolver for bare module specifiers (issue #1595).
//
// During the early frames of a codegen session — before the fsId-bound import
// map has been materialized — the iframe's import map only contains the locked
// runtime groups. If the streaming source imports an unenumerated bare name
// (e.g. `three`, `chart.js`, `tone`), the browser's native ESM resolver rejects
// it with "Failed to resolve module specifier ...". We avoid that by rewriting
// such specifiers to `https://esm.sh/<name>` before evaluating the hot-swap
// blob. Specifiers already keyed in the active import map (or matched by the
// trailing-slash prefix rule) are left untouched, so the fsId-bound map keeps
// taking precedence once it activates.
//
// Legacy vibes (issue #1735) sometimes hardcode a fully-qualified CDN URL such
// as `https://unpkg.com/call-ai@latest/dist/call-ai.js`. unpkg 302-redirects
// `@latest` → `@x.y.z`, and that redirect response carries no
// `Access-Control-Allow-Origin` header, so the cross-origin script fetch from
// `*.vibesdiy.net` is CORS-blocked and the hot-swap iframe never loads. unpkg's
// path layout (`/<pkg>[@<version>]/<subpath>`) maps 1:1 onto esm.sh, which does
// send CORS headers, so we host-swap those URLs to `https://esm.sh/<same-path>`.
// We only touch hosts whose path layout is esm.sh-compatible — other CDNs
// (e.g. cdnjs's `/ajax/libs/...`) are left untouched.
//
// Scope: we only rewrite the top-of-file import region — the prefix made up of
// blank lines, comments, and lines whose first non-whitespace token is
// `import`. The first non-blank, non-comment line that does not start with
// `import` ends the region; everything after is left verbatim. This keeps
// regex-based rewriting away from string literals and comments in the module
// body, where false positives could mutate runtime data.

import { URI } from "@adviser/cement";

const RELATIVE_OR_URL = /^(?:\.\.?\/|\/|https?:\/\/|blob:|data:)/;

// CDN hosts whose path layout (`/<pkg>[@<version>]/<subpath>`) is esm.sh
// compatible, but which don't reliably send CORS headers on redirects. Their
// fully-qualified URLs are host-swapped to esm.sh.
const CDN_HOST_REWRITES = new Set(["unpkg.com", "www.unpkg.com"]);

function isMappedByImportMap(spec: string, imports: Record<string, string>): boolean {
  if (Object.prototype.hasOwnProperty.call(imports, spec)) return true;
  for (const key of Object.keys(imports)) {
    if (key.endsWith("/") && spec.startsWith(key)) return true;
  }
  return false;
}

// Host-swap a fully-qualified CDN URL onto esm.sh when its layout is
// compatible; otherwise return null so the URL is left verbatim. Uses cement's
// URI (not `new URL`, which is not stable across runtimes per rules-bag) and
// its `fromResult` parser so an unparseable specifier surfaces as a Result
// rather than a throw. `URI.hostname` only reads on http(s)-style protocols, so
// the protocol guard must run before touching the host.
function rewriteCdnUrl(spec: string): string | null {
  const rUri = URI.fromResult(spec);
  if (rUri.isErr()) return null;
  const uri = rUri.Ok();
  if (uri.protocol !== "https:" && uri.protocol !== "http:") return null;
  if (!CDN_HOST_REWRITES.has(uri.hostname)) return null;
  const path = uri.pathname.replace(/^\/+/, "");
  if (path.length === 0) return null;
  return `https://esm.sh/${path}${uri.search}${uri.hash}`;
}

// Resolve a specifier to its rewritten form, or null when it should be left
// untouched. Bare names go to `https://esm.sh/<name>`; known CORS-unfriendly
// CDN URLs are host-swapped to esm.sh; everything else (mapped specifiers,
// relative paths, other absolute URLs) is left alone.
function resolveSpecifier(spec: string, imports: Record<string, string>): string | null {
  if (isMappedByImportMap(spec, imports)) return null;
  if (RELATIVE_OR_URL.test(spec)) {
    const swapped = rewriteCdnUrl(spec);
    if (swapped) {
      // Breadcrumb (#1735): the host-swap is the surprising rewrite — the user
      // wrote a unpkg URL but will see esm.sh in the network tab. Without this
      // log, an esm.sh load failure surfaces as a generic "[hot-swap iframe]
      // failed" with no link back to the original URL or this rewrite. Bare
      // specifiers (the common #1595 path) stay quiet to avoid console noise.
      if (typeof console !== "undefined") {
        console.info(`[hot-swap] rewrote CDN URL to esm.sh for CORS (issue #1735): ${spec} -> ${swapped}`);
      }
    }
    return swapped;
  }
  return `https://esm.sh/${spec}`;
}

// Returns the byte offset where the import region ends. Walks the source
// from the top, skipping blank space and `//` / `/* … */` comments. When the
// next non-trivia token is the keyword `import`, consumes the entire
// statement — tracking string literals and brace/paren depth so multi-line
// `import {\n  foo,\n} from "x";` stays inside the region. The first
// non-trivia token that isn't `import` ends the region.
function findImportRegionEnd(code: string): number {
  let i = 0;
  while (i < code.length) {
    i = skipTrivia(code, i);
    if (i >= code.length) return i;
    if (matchesKeyword(code, i, "import")) {
      i = consumeStatement(code, i);
      continue;
    }
    return i;
  }
  return i;
}

function skipTrivia(code: string, start: number): number {
  let i = start;
  while (i < code.length) {
    const c = code[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < code.length - 1 && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    return i;
  }
  return i;
}

function matchesKeyword(code: string, i: number, kw: string): boolean {
  if (code.slice(i, i + kw.length) !== kw) return false;
  const next = code[i + kw.length];
  // Allow whitespace, `(`, or a string-literal quote to follow `import` —
  // covers `import x`, `import {`, `import "x"`, `import 'x'`, `import(...)`.
  return next === undefined || /\s/.test(next) || next === "(" || next === '"' || next === "'";
}

// Consumes from `start` (positioned at the `import` keyword) through the end
// of the statement. End-of-statement is either a `;` at brace/paren depth 0,
// or a newline at depth 0 — covering the no-semicolon (ASI) case. String and
// comment contents are skipped so their punctuation doesn't move the depth.
function consumeStatement(code: string, start: number): number {
  let i = start;
  let braceDepth = 0;
  let parenDepth = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(code, i, c);
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < code.length - 1 && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "{") {
      braceDepth++;
      i++;
      continue;
    }
    if (c === "}") {
      braceDepth--;
      i++;
      continue;
    }
    if (c === "(") {
      parenDepth++;
      i++;
      continue;
    }
    if (c === ")") {
      parenDepth--;
      i++;
      continue;
    }
    if (c === ";" && braceDepth === 0 && parenDepth === 0) {
      return i + 1;
    }
    if (c === "\n" && braceDepth === 0 && parenDepth === 0) {
      return i + 1;
    }
    i++;
  }
  return i;
}

function skipString(code: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < code.length) {
    const c = code[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    i++;
  }
  return i;
}

// Rewrites the module specifiers inside the top-of-file import region using
// `mapSpec`. For each specifier, `mapSpec` returns the replacement string, or
// `undefined` to leave it untouched. Shared by rewriteBareSpecifiers (bare →
// esm.sh) and rewriteRelativeSpecifiers (relative → absolute URL) so both walk
// the same import region and use the same statement-shape regexes.
function rewriteImportRegion(code: string, mapSpec: (spec: string) => string | undefined): string {
  const regionEnd = findImportRegionEnd(code);
  if (regionEnd === 0) return code;
  const head = code.slice(0, regionEnd);
  const tail = code.slice(regionEnd);

  // `import ... from "spec"` and `export ... from "spec"`
  const fromRe = /\bfrom(\s*)(['"])([^'"\n]+)\2/g;
  // dynamic `import("spec")` — only with a literal string argument
  const dynRe = /\bimport(\s*)\((\s*)(['"])([^'"\n]+)\3/g;
  // side-effect `import "spec"` at statement start (no `(` after `import`)
  const sideEffectRe = /(^|[\s;{}])import(\s*)(['"])([^'"\n]+)\3/g;

  let out = head.replace(dynRe, (m, ws1, ws2, q, spec) => {
    const next = mapSpec(spec);
    return next === undefined ? m : `import${ws1}(${ws2}${q}${next}${q}`;
  });
  out = out.replace(fromRe, (m, ws, q, spec) => {
    const next = mapSpec(spec);
    return next === undefined ? m : `from${ws}${q}${next}${q}`;
  });
  out = out.replace(sideEffectRe, (m, pre, ws, q, spec) => {
    const next = mapSpec(spec);
    return next === undefined ? m : `${pre}import${ws}${q}${next}${q}`;
  });
  return out + tail;
}

export function rewriteBareSpecifiers(code: string, imports: Record<string, string>): string {
  return rewriteImportRegion(code, (spec) => resolveSpecifier(spec, imports) ?? undefined);
}

// Relative specifiers only: `./x`, `../x`, `/x`, and protocol-relative `//host`.
// Absolute URL forms (http(s):, blob:, data:) and bare names are excluded —
// bare names are handled by rewriteBareSpecifiers, absolute URLs need no change.
const RELATIVE_SPEC = /^(?:\.\.?\/|\/)/;

// Hot-swap injects the entry module via a `blob:` URL, against which the browser
// cannot resolve relative imports like `./Badge.jsx` — blob URLs aren't
// hierarchical (issue #1889). Rewrite each relative specifier to an absolute URL
// resolved against `baseUrl` (the `/~fsId~/` entry directory, see
// getHotSwapBaseUrl), so siblings load from the sandbox origin exactly as they
// do on a full page load. No base (or an unparseable specifier) leaves the code
// as-is.
export function rewriteRelativeSpecifiers(code: string, baseUrl: string | undefined): string {
  if (!baseUrl) return code;
  return rewriteImportRegion(code, (spec) => {
    if (!RELATIVE_SPEC.test(spec)) return undefined;
    try {
      return new URL(spec, baseUrl).href;
    } catch {
      return undefined;
    }
  });
}

// Derive the base URL relative imports must resolve against from the iframe's
// own location. The preview iframe loads the entry at `/~<fsId>~` with NO
// trailing slash (calcEntryPointUrl), so on a full load the entry MODULE URL is
// `/~<fsId>~/App.jsx` and its `./Badge.jsx` resolves to `/~<fsId>~/Badge.jsx`.
// We must reproduce that directory base — NOT document.baseURI, whose directory
// is the origin root (`new URL("./Badge.jsx", "https://h/~fs~")` → `https://h/Badge.jsx`).
// Returns undefined for non-fsId locations (e.g. the bare-host pending shell),
// which leaves relative specifiers untouched.
export function entryDirBase(origin: string, pathname: string): string | undefined {
  const m = /^\/(~[^/~]+~)\/?$/.exec(pathname);
  if (!m) return undefined;
  return `${origin}/${m[1]}/`;
}

export function getHotSwapBaseUrl(): string | undefined {
  if (typeof window === "undefined" || !window.location) return undefined;
  return entryDirBase(window.location.origin, window.location.pathname);
}

export function getActiveImportMap(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const el = document.querySelector('script[type="importmap"]');
  const text = el?.textContent;
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as { imports?: unknown };
    if (parsed && typeof parsed === "object" && parsed.imports && typeof parsed.imports === "object") {
      return parsed.imports as Record<string, string>;
    }
  } catch {
    // malformed importmap — treat as empty so the fallback still kicks in
  }
  return {};
}
