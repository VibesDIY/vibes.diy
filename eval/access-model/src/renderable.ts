export interface FileCheck {
  readonly twoFile: boolean; // both access.js and App.jsx present and non-trivial
  readonly renderable: boolean; // App.jsx parses-ish, no dup import, not an access-fn clobber
  readonly reasons: string[];
}

const NONTRIVIAL = 40; // chars

function dupImport(src: string): boolean {
  const names = new Map<string, number>();
  for (const m of src.matchAll(/import\s+\{([^}]*)\}\s+from/g)) {
    for (const raw of m[1].split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)[0]
        .trim();
      if (!name) continue;
      names.set(name, (names.get(name) ?? 0) + 1);
    }
  }
  return [...names.values()].some((n) => n > 1);
}

export function checkFiles(files: Record<string, string>): FileCheck {
  const reasons: string[] = [];
  const app = files["App.jsx"] ?? "";
  const access = files["access.js"] ?? "";
  const twoFile = app.trim().length >= NONTRIVIAL && access.trim().length >= NONTRIVIAL;
  if (!twoFile) reasons.push("missing or trivial access.js/App.jsx");

  const isAccessClobber = /export\s+default\s+function\s+access\s*\(/.test(app) && !/function\s+App\s*\(/.test(app);
  if (isAccessClobber) reasons.push("App.jsx contains the access function (filename clobber)");
  const hasDup = dupImport(app);
  if (hasDup) reasons.push("duplicate import (ESM redeclaration)");
  const hasApp = /export\s+default\s+function\s+App\s*\(|export\s+default\s+App\b/.test(app);
  if (!hasApp) reasons.push("no default App export");

  const renderable = hasApp && !isAccessClobber && !hasDup;
  return { twoFile, renderable, reasons };
}
