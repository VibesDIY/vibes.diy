#!/usr/bin/env node

// Asserts the publish-build guard's coverage invariant:
//   every NON-private workspace package must define a REAL `pack` script.
//
// The guard (ci.yaml `publish_build` job) runs `pnpm -r run --if-present pack`,
// which silently SKIPS any package without a `pack` script. So a publishable
// package that omits `pack` — or stubs it with `echo` — sails through CI green
// while its isolated publish build never runs. That's the #2855 failure mode:
// an out-of-package import / missing dep / exports gap that only breaks the
// standalone publish build surfaces as a red RELEASE, not a red PR.
//
// The rule makes `private` the single source of truth:
//   - non-private  => a published library  => MUST have a real (non-echo) `pack`
//   - private      => worker / app / test / eval => exempt (the guard skips it)
//
// So the two ways to satisfy this check are also the two correct fixes:
//   • add a real `pack` (e.g. "core-cli build --doPack") if it IS published, or
//   • mark it "private": true if it is NOT (deployed via wrangler, a test, etc.).
//
// Triggered by #2862 / #2888 / #2889 and the api-logpush-etl / api-queue cleanup.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

// Parse the package globs out of pnpm-workspace.yaml's `packages:` block.
function workspacePatterns() {
  const src = readFileSync(join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  const patterns = [];
  let inPackages = false;
  for (const line of src.split("\n")) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = line.match(/^\s*-\s*["']?([^"'#]+?)["']?\s*$/);
    if (item) {
      patterns.push(item[1].trim());
      continue;
    }
    // A line that isn't a list item and isn't indented ends the block.
    if (/^\S/.test(line)) break;
  }
  return patterns;
}

// Expand a workspace pattern to package directories. Today's patterns are
// either exact paths ("vibes.diy/identity") or a single trailing "/*"
// ("vibes.diy/api/*"); no "**" is used. If a "**" pattern is ever added this
// resolver would miss it — assert against that so the check fails loudly
// rather than silently under-covering.
function expandPattern(pattern) {
  if (pattern.includes("**")) {
    throw new Error(
      `check-publish-pack-coverage: unsupported "**" glob in pnpm-workspace.yaml ("${pattern}"). ` +
        `Extend expandPattern() to handle it.`,
    );
  }
  if (pattern.endsWith("/*")) {
    const parent = pattern.slice(0, -2);
    try {
      return readdirSync(join(repoRoot, parent), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => `${parent}/${e.name}`);
    } catch {
      return [];
    }
  }
  return [pattern];
}

const dirs = new Set();
for (const pattern of workspacePatterns()) {
  for (const dir of expandPattern(pattern)) dirs.add(dir);
}

const violations = [];
for (const dir of [...dirs].sort()) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(repoRoot, dir, "package.json"), "utf8"));
  } catch {
    continue; // not a package directory
  }
  if (!pkg.name) continue;
  if (pkg.private === true) continue; // private = not published, exempt

  const pack = pkg.scripts?.pack;
  const isReal = typeof pack === "string" && pack.trim() !== "" && !pack.trim().startsWith("echo");
  if (!isReal) {
    violations.push({ name: pkg.name, dir, pack: pack ?? "<none>" });
  }
}

if (violations.length > 0) {
  console.error(
    `\n❌ publish-build coverage: ${violations.length} non-private package(s) without a real \`pack\` script.\n`,
  );
  console.error("The `publish_build` CI job runs `pnpm -r run --if-present pack`, which SKIPS");
  console.error("packages that have no `pack`. A non-private (published) package without a real");
  console.error("`pack` therefore ships its isolated publish build UNCHECKED — a publish-only");
  console.error("break would surface as a red release, not a red PR (#2862 / #2855).\n");
  for (const { name, dir, pack } of violations) {
    console.error(`  ${name}  (${dir})  pack=${JSON.stringify(pack)}`);
  }
  console.error("\nFix one of:");
  console.error('  • add a real `pack` (e.g. "core-cli build --doPack") if the package IS published; or');
  console.error('  • mark it "private": true if it is NOT npm-published (a worker, the app, a test pkg).\n');
  process.exit(1);
} else {
  console.log("✅ publish-build coverage check passed — every non-private package has a real `pack`.");
}
