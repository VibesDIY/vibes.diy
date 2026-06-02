#!/usr/bin/env node

// Validates that every bare import specifier in browser-facing packages
// is present in the vibe import map. Catches unmapped dependencies that
// would cause "Failed to resolve module specifier" in the browser.
//
// Triggered by: the pkg@p2.4.10 incident where @fireproof/core-runtime
// was imported by call-ai-v2 but not in the import map, blanking all vibes.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

// Packages served to the browser via privateNpm / vibe-pkg.
// These are ESM modules the browser loads directly — every bare specifier
// they import must be resolvable in the browser.
const browserPackagePaths = [
  "call-ai/v2",
  "vibes.diy/vibe/runtime",
  "vibes.diy/vibe/types",
];

// Files that are NOT browser-facing even though they live in browser packages.
const excludePatterns = [
  /\.test\.ts$/,
  /\.node\.ts$/,
  /\.d\.ts$/,
  /cli\.ts$/,
  /vitest.*\.config\.ts$/,
  /\.storybook\//,
  /bare-specifier-rewrite\.ts$/,
];

// Packages that are bundled INTO the privateNpm packages at build time
// (they're dependencies of the built package, not separate browser imports).
// These don't need import map entries because they're inlined by the bundler.
const bundledDependencies = new Set([
  "charwise",
]);

// Extract all import map keys from grouped-vibe-import-map.ts.
// Handles both top-level keys and nested group keys.
function extractImportMapKeys() {
  const mapFile = join(repoRoot, "vibes.diy/api/svc/intern/grouped-vibe-import-map.ts");
  const source = readFileSync(mapFile, "utf8");
  const keys = new Set();

  // Match keys (quoted or unquoted) that have string values.
  // Catches: "react": "version:REACT", react: "version:REACT",
  //          "@adviser/cement": "version:...", sucrase: "version:SUCRASE"
  // Skips group names whose values are objects: react: { ... }
  const pattern = /^\s*(?:"([^"]+)"|(\w[\w.-]*))\s*:\s*"([^"]*)"/gm;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    keys.add(match[1] || match[2]);
  }

  return keys;
}

function extractBareImports(filePath) {
  const source = readFileSync(filePath, "utf8");
  const imports = new Set();

  // Match import/export ... from "specifier" and import "specifier"
  const importPattern = /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    const specifier = match[1];
    if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.includes("://")) {
      continue;
    }
    // Strip .js suffix — TS source imports "foo.js" but the bare package is "foo"
    imports.add(specifier.replace(/\.js$/, ""));
  }

  return [...imports];
}

function walkTs(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkTs(full));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        results.push(full);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

function isInImportMap(specifier, mapKeys) {
  if (mapKeys.has(specifier)) return true;

  // Check trailing-slash prefix matches (import map prefix rule)
  for (const key of mapKeys) {
    if (key.endsWith("/") && specifier.startsWith(key)) return true;
  }

  // Check if specifier is a subpath of a mapped package
  // e.g. "arktype" is mapped, so "arktype/foo" would resolve
  const parts = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
  if (mapKeys.has(parts)) return true;

  return false;
}

// Main
const mapKeys = extractImportMapKeys();
const violations = [];

for (const pkgPath of browserPackagePaths) {
  const absPath = join(repoRoot, pkgPath);
  const files = walkTs(absPath);

  for (const file of files) {
    const rel = relative(repoRoot, file);
    if (excludePatterns.some((p) => p.test(rel))) continue;

    const imports = extractBareImports(file);
    for (const specifier of imports) {
      if (bundledDependencies.has(specifier)) continue;
      if (!isInImportMap(specifier, mapKeys)) {
        violations.push({ file: rel, specifier });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\n❌ Browser import map violation: ${violations.length} unmapped bare specifier(s).\n`);
  console.error("These packages are served to the browser via /vibe-pkg/. Every bare import");
  console.error("specifier must have a matching key in grouped-vibe-import-map.ts.\n");

  for (const { file, specifier } of violations) {
    console.error(`  ${file}: "${specifier}"`);
  }

  console.error("\nFix: add the missing specifier to grouped-vibe-import-map.ts, or replace");
  console.error("the import with a package that's already in the map.\n");
  process.exit(1);
} else {
  console.log("✅ Browser import map check passed — all bare specifiers are mapped.");
}
