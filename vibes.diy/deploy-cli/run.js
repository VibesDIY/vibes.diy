#!/usr/bin/env node

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as process from "process";
import { fileURLToPath } from "url";

// Shared bin bootstrap for the monorepo's command CLIs (build-cli, deploy-cli, …).
// Kept byte-identical across packages: it resolves its own directory from
// import.meta.url (so it's bin-name agnostic) and never depends on a cross-package
// import, because the deploy runs it under a bare `node run.js` with no
// node_modules/.bin on PATH. See VibesDIY/vibes.diy#2926.

function exec(cmd, args) {
  const child = spawn(cmd, args, {
    stdio: "inherit", // inherits stdin, stdout, and stderr
  });
  child.on("close", (code) => {
    process.exit(code);
  });
  child.on("error", (error) => {
    console.error(`Failed to start ${cmd}: ${error.message}`);
    process.exit(1);
  });
}

const runDirectory = path.dirname(fs.realpathSync(fileURLToPath(import.meta.url)));
const restArgv = process.argv.slice(2);

const mainJs = path.join(runDirectory, "main.js");
if (fs.existsSync(mainJs)) {
  // make windows happy file://
  import(`file://${mainJs}`).catch((e) => console.error(e));
} else {
  // `node --import tsx` uses the current node binary and resolves tsx from the
  // workspace, so it works without node_modules/.bin on PATH and without a build.
  exec(process.execPath, ["--import", "tsx", path.join(runDirectory, "main.ts"), ...restArgv]);
}
