#!/usr/bin/env node

// Thin launcher that resolves tsx from this package's own node_modules,
// then re-executes cli.ts with the tsx loader. This avoids:
// - ERR_UNKNOWN_FILE_EXTENSION when bin is invoked via `node <path>`
// - cwd-sensitive resolution of tsx (--import tsx fails outside pkg dir)

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "package.json"));
const tsxPath = require.resolve("tsx");

const child = spawn(process.execPath, ["--import", tsxPath, join(__dirname, "cli.ts"), ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});
