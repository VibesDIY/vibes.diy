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
// Scope: we only rewrite the top-of-file import region — the prefix made up of
// blank lines, comments, and lines whose first non-whitespace token is
// `import`. The first non-blank, non-comment line that does not start with
// `import` ends the region; everything after is left verbatim. This keeps
// regex-based rewriting away from string literals and comments in the module
// body, where false positives could mutate runtime data.

const RELATIVE_OR_URL = /^(?:\.\.?\/|\/|https?:\/\/|blob:|data:)/;

function isMappedByImportMap(spec: string, imports: Record<string, string>): boolean {
  if (Object.prototype.hasOwnProperty.call(imports, spec)) return true;
  for (const key of Object.keys(imports)) {
    if (key.endsWith("/") && spec.startsWith(key)) return true;
  }
  return false;
}

function shouldRewrite(spec: string, imports: Record<string, string>): boolean {
  if (RELATIVE_OR_URL.test(spec)) return false;
  if (isMappedByImportMap(spec, imports)) return false;
  return true;
}

function fallbackUrl(spec: string): string {
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

export function rewriteBareSpecifiers(code: string, imports: Record<string, string>): string {
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

  let out = head.replace(dynRe, (m, ws1, ws2, q, spec) =>
    shouldRewrite(spec, imports) ? `import${ws1}(${ws2}${q}${fallbackUrl(spec)}${q}` : m
  );
  out = out.replace(fromRe, (m, ws, q, spec) => (shouldRewrite(spec, imports) ? `from${ws}${q}${fallbackUrl(spec)}${q}` : m));
  out = out.replace(sideEffectRe, (m, pre, ws, q, spec) =>
    shouldRewrite(spec, imports) ? `${pre}import${ws}${q}${fallbackUrl(spec)}${q}` : m
  );
  return out + tail;
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
