#!/usr/bin/env node

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as process from "process";

function exec(cmd, args) {
  const tsc = spawn(cmd, args, {
    stdio: "inherit", // inherits stdin, stdout, and stderr
  });

  tsc.on("close", (code) => {
    process.exit(code);
  });

  tsc.on("error", (error) => {
    // eslint-disable-next-line no-console, no-undef
    console.error(`Failed to start ${cmd}: ${error.message}`);
    process.exit(1);
  });
}

const idxRunIdx = process.argv.findIndex((i) => i.endsWith("run.js") || i.endsWith("deploy-cli"));
const runDirectory = path.dirname(fs.realpathSync(process.argv[idxRunIdx]));

const mainJs = path.join(runDirectory, "main.js");
if (fs.existsSync(mainJs)) {
  // make windows happy file://
  const addFile = `file://${mainJs}`;
  // eslint-disable-next-line no-console, no-undef
  import(addFile).catch((e) => console.error(e));
} else {
  // Run main.ts directly. The deploy invokes this via a bare `node run.js`
  // (no pnpm script context), so node_modules/.bin is NOT on PATH — spawning
  // `tsx` by name would ENOENT. `node --import tsx` uses the current node
  // binary and resolves tsx from this package's node_modules, so it works
  // without PATH and without a prior build step.
  const restArgv = process.argv.slice(idxRunIdx + 1) ?? [];
  exec(process.execPath, ["--import", "tsx", path.join(runDirectory, "main.ts"), ...restArgv]);
}
