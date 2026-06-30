#!/usr/bin/env node

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as process from "process";

const BUILD_CLI_COMMANDS = new Set(["tsc", "build"]);

function exec(cmd, args) {
  const tsc = spawn(cmd, args, {
    stdio: "inherit", // inherits stdin, stdout, and stderr
  });

  tsc.on("close", (code) => {
    process.exit(code ?? 1);
  });

  tsc.on("error", (error) => {
    // eslint-disable-next-line no-console, no-undef
    console.error(`Failed to start ${cmd}: ${error.message}`);
    process.exit(1);
  });
}

function findLegacyRunJs(startDirectory) {
  let currentDirectory = startDirectory;

  while (true) {
    const pnpmDirectory = path.join(currentDirectory, "node_modules", ".pnpm");
    if (fs.existsSync(pnpmDirectory)) {
      const matchingPackageDirectory = fs
        .readdirSync(pnpmDirectory)
        .filter((entry) => entry.startsWith("@fireproof+core-cli@"))
        .sort()
        .find((entry) => fs.existsSync(path.join(pnpmDirectory, entry, "node_modules", "@fireproof", "core-cli", "run.js")));

      if (matchingPackageDirectory) {
        return path.join(pnpmDirectory, matchingPackageDirectory, "node_modules", "@fireproof", "core-cli", "run.js");
      }
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return undefined;
    }

    currentDirectory = parentDirectory;
  }
}

const idxRunIdx = process.argv.findIndex((i) => i.endsWith("run.js") || i.endsWith("core-cli"));
const runDirectory = path.dirname(fs.realpathSync(process.argv[idxRunIdx]));
const restArgv = process.argv.slice(idxRunIdx + 1) ?? [];
const subcommand = restArgv[0];

const mainJs = path.join(runDirectory, "main.js");
if (fs.existsSync(mainJs)) {
  // make windows happy file://
  const addFile = `file://${mainJs}`;
  // eslint-disable-next-line no-console, no-undef
  import(addFile).catch((e) => console.error(e));
} else if (subcommand && !subcommand.startsWith("-") && !BUILD_CLI_COMMANDS.has(subcommand)) {
  const legacyRunJs = findLegacyRunJs(runDirectory);

  if (!legacyRunJs) {
    // eslint-disable-next-line no-console, no-undef
    console.error(`Unsupported core-cli subcommand \`${subcommand}\` and legacy @fireproof/core-cli was not found`);
    process.exit(1);
  }

  exec(process.execPath, [legacyRunJs, ...restArgv]);
} else {
  const tsxCli = path.join(runDirectory, "node_modules", "tsx", "dist", "cli.mjs");
  if (!fs.existsSync(tsxCli)) {
    // eslint-disable-next-line no-console, no-undef
    console.error(`Missing local tsx CLI at ${tsxCli}`);
    process.exit(1);
  }

  exec(process.execPath, [tsxCli, path.join(runDirectory, "main.ts"), ...restArgv]);
}
