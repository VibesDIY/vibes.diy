import { computeStructure } from "@vibes.diy/eval-codegen-matrix/scoring";

export type VerifyResult = { ok: boolean; problems: string[] };

// Cheap, Workers-safe syntax heuristic: balanced (), {}, []. Not a parser —
// the authoritative parse/render check is the client render gate (Plan 2).
function balanced(code: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "}": "{", "]": "[" };
  const stack: string[] = [];
  for (const ch of code) {
    if (ch === "(" || ch === "{" || ch === "[") stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

export function verifyFiles(files: Record<string, string>, opts: { needsAccess: boolean }): VerifyResult {
  const problems: string[] = [];
  const app = files["App.jsx"] ?? files["/App.jsx"];
  if (!app) return { ok: false, problems: ["App.jsx is missing"] };
  if (!/export\s+default\s+/.test(app)) problems.push("App.jsx has no default export");
  for (const [name, code] of Object.entries(files)) {
    if (!/\.(jsx?|tsx?)$/.test(name)) continue;
    if (!balanced(code)) problems.push(`${name}: unbalanced brackets (likely a syntax error)`);
  }
  const s = computeStructure(files);
  if (opts.needsAccess && !s.hasAccessJs) {
    problems.push("This app needs per-document permissions but no separate access.js was written. Add an access.js file.");
  }
  if (opts.needsAccess && s.accessInAppJsx) {
    problems.push("Access-control logic is in App.jsx; move it into a separate access.js file.");
  }
  return { ok: problems.length === 0, problems };
}
