#!/usr/bin/env node

// Why this file exists:
//
// Node/npm entrypoints still execute JavaScript directly (`node <path>`).
// During the Deno-first transition, this wrapper keeps `npx use-vibes`
// working by delegating to cli.ts through tsx.

import { spawn } from "node:child_process";
import { join } from "node:path";
import { createRequire } from "node:module";

const __dirname = import.meta.dirname;
const require = createRequire(join(__dirname, "package.json"));
const tsxLoader = require.resolve("tsx");

const child = spawn(
  process.execPath,
  ["--import", tsxLoader, join(__dirname, "cli.ts"), ...process.argv.slice(2)],
  { stdio: "inherit" },
);

child.on("close", (code) => {
  process.exitCode = code ?? 1;
});
