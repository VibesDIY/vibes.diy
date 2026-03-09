interface Violation {
  readonly filePath: string;
  readonly line: number;
  readonly specifier: string;
}

const pkgDir = Deno.realPathSync(new URL("../", import.meta.url));
const ignoredDirNames = new Set(["dist", "node_modules", ".git"]);
const importSpecifierPattern =
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)|\b(?:import|export)\b[\s\S]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']/g;

function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function lineNumberFor(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function toRelativePath(filePath: string): string {
  const normalizedPrefix = `${pkgDir}/`;
  if (filePath.startsWith(normalizedPrefix)) {
    return filePath.slice(normalizedPrefix.length);
  }
  return filePath;
}

async function collectTypeScriptFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dirPath)) {
    if (ignoredDirNames.has(entry.name)) {
      continue;
    }

    const childPath = `${dirPath}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...(await collectTypeScriptFiles(childPath)));
      continue;
    }

    if (entry.isFile && childPath.endsWith(".ts")) {
      files.push(childPath);
    }
  }
  return files;
}

function collectViolations(filePath: string, source: string): Violation[] {
  const violations: Violation[] = [];

  for (const match of source.matchAll(importSpecifierPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (typeof specifier === "undefined") {
      continue;
    }
    if (isLocalSpecifier(specifier) && specifier.endsWith(".ts")) {
      violations.push({
        filePath,
        line: lineNumberFor(source, match.index ?? 0),
        specifier,
      });
    }
  }

  return violations;
}

const files = await collectTypeScriptFiles(pkgDir);
const violations: Violation[] = [];

for (const filePath of files) {
  const source = await Deno.readTextFile(filePath);
  violations.push(...collectViolations(filePath, source));
}

if (violations.length > 0) {
  console.error("Found local import specifiers ending in .ts. Use .js specifiers for local imports in use-vibes/pkg.");
  for (const violation of violations) {
    const relativeFile = toRelativePath(violation.filePath);
    console.error(`- ${relativeFile}:${violation.line} -> ${violation.specifier}`);
  }
  Deno.exit(1);
}

console.log("Local import specifier check passed.");
