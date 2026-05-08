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

export function rewriteBareSpecifiers(code: string, imports: Record<string, string>): string {
  // `import ... from "spec"` and `export ... from "spec"`
  const fromRe = /\bfrom(\s*)(['"])([^'"\n]+)\2/g;
  // dynamic `import("spec")` — only with a literal string argument
  const dynRe = /\bimport(\s*)\((\s*)(['"])([^'"\n]+)\3/g;
  // side-effect `import "spec"` at statement start (no `(` after `import`)
  const sideEffectRe = /(^|[\s;{}])import(\s*)(['"])([^'"\n]+)\3/g;

  let out = code.replace(dynRe, (m, ws1, ws2, q, spec) =>
    shouldRewrite(spec, imports) ? `import${ws1}(${ws2}${q}${fallbackUrl(spec)}${q}` : m
  );
  out = out.replace(fromRe, (m, ws, q, spec) => (shouldRewrite(spec, imports) ? `from${ws}${q}${fallbackUrl(spec)}${q}` : m));
  out = out.replace(sideEffectRe, (m, pre, ws, q, spec) =>
    shouldRewrite(spec, imports) ? `${pre}import${ws}${q}${fallbackUrl(spec)}${q}` : m
  );
  return out;
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
