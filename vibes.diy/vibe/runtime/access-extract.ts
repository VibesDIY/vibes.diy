// Pure, browser-safe port of the server's extractExportSource
// (vibes.diy/api/svc/public/access-function.ts). Kept byte-identical in
// behavior; enforced by access-runner-parity.test.ts. No imports.
export function extractExportSource(fullSource: string, bindingDbName: string): string | undefined {
  if (bindingDbName === "*") {
    return extractByPattern(
      fullSource,
      /export\s+default\s+(?:function\s*(?:\w+\s*)?\([^)]*\)\s*\{|\([^)]*\)\s*=>\s*\{|\w+\s*=>\s*\{)/,
      true
    );
  }
  const directPattern = new RegExp(`export\\s+function\\s+${escapeRegExp(bindingDbName)}\\s*\\([^)]*\\)\\s*\\{`);
  const direct = extractByPattern(fullSource, directPattern, false);
  if (direct) return direct;
  const asMatch = fullSource.match(new RegExp(`export\\s*\\{\\s*(\\w+)\\s+as\\s+["']${escapeRegExp(bindingDbName)}["']\\s*\\}`));
  if (asMatch) {
    const localName = asMatch[1];
    const fnPattern = new RegExp(`function\\s+${localName}\\s*\\([^)]*\\)\\s*\\{`);
    return extractByPattern(fullSource, fnPattern, false);
  }
  return undefined;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractByPattern(fullSource: string, pattern: RegExp, isDefault: boolean): string | undefined {
  const match = fullSource.match(pattern);
  if (!match || match.index === undefined) return undefined;
  const start = match.index;
  let depth = 0;
  let end = start;
  for (let i = start; i < fullSource.length; i++) {
    if (fullSource[i] === "{") depth++;
    if (fullSource[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  let extracted = fullSource.slice(start, end).replace(/^export\s+/, "");
  if (isDefault) extracted = extracted.replace(/^default\s+/, "");
  return extracted;
}
