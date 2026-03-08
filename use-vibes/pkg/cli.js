#!/usr/bin/env node

// Why this file exists:
//
// npm bin linking runs files with `node <path>`, which cannot execute .ts
// files without a loader. The shebang `#!/usr/bin/env -S node --import tsx`
// in cli.ts works on some systems but fails when:
//
//   1. `node cli.ts` is invoked directly — ERR_UNKNOWN_FILE_EXTENSION
//   2. tsx is not resolvable from cwd — ERR_MODULE_NOT_FOUND
//
// This thin JS wrapper resolves tsx from the package's own node_modules
// (via createRequire anchored to this directory), then re-executes cli.ts
// with the tsx loader registered. One extra process spawn at startup is
// the cost of staying build-free while working everywhere npm does.

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "package.json"));
const tsxPath = require.resolve("tsx");

const child = spawn(
  process.execPath,
  ["--import", tsxPath, join(__dirname, "cli.ts"), ...process.argv.slice(2)],
  { stdio: "inherit" },
);

child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
