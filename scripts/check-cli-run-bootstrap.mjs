#!/usr/bin/env node

// Validates that the command CLIs' bin bootstraps (vibes.diy/*/run.js) are all
// byte-identical. They are intentionally one shared, self-contained bootstrap
// copied per package (it can't be a cross-package import — the deploy runs it
// under bare `node` with no node_modules/.bin on PATH). This guard prevents the
// copies from silently drifting, which is exactly what motivated the cmd-harness
// dedup (VibesDIY/vibes.diy#2926).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const cliRoot = join(repoRoot, "vibes.diy");

const runJsFiles = readdirSync(cliRoot)
  .map((name) => join(cliRoot, name, "run.js"))
  .filter((p) => {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  })
  .sort();

if (runJsFiles.length < 2) {
  // Nothing to compare (0 or 1 bootstrap) — guard is a no-op.
  console.log(`✅ cli run.js bootstrap check passed — ${runJsFiles.length} bootstrap(s), nothing to diff.`);
  process.exit(0);
}

const [reference, ...rest] = runJsFiles;
const referenceContent = readFileSync(reference, "utf8");
const mismatches = rest.filter((p) => readFileSync(p, "utf8") !== referenceContent);

if (mismatches.length > 0) {
  console.error(`\n❌ cli run.js bootstrap check: ${mismatches.length} bin bootstrap(s) drifted from ${relative(repoRoot, reference)}.\n`);
  for (const p of mismatches) {
    console.error(`  • ${relative(repoRoot, p)}`);
  }
  console.error(
    "\nThe command CLIs (build-cli, deploy-cli, …) share one byte-identical run.js bootstrap." +
      "\nCopy the reference verbatim, or update every copy together. See VibesDIY/vibes.diy#2926.\n"
  );
  process.exit(1);
}

console.log(`✅ cli run.js bootstrap check passed — ${runJsFiles.length} bootstraps byte-identical.`);
