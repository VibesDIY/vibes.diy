#!/usr/bin/env node

// Why this file exists:
//
// npm bin linking runs files with `node <path>`, which cannot execute .ts
// files without a loader. This thin JS wrapper resolves tsx from the
// package's own node_modules, then re-executes cli.ts with the tsx loader
// registered. One extra process spawn at startup is the cost of staying
// build-free while working everywhere npm does.
//
// TODO: migrate to zx/cement when deno is primary runtime — bootstrap kept
// minimal with Node builtins only

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
