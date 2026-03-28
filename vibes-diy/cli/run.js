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
    // eslint-disable-next-line no-undef
    console.error(`Failed to start ${cmd}: ${error.message}`);
    process.exit(1);
  });
}

// import { fileURLToPath } from "url";
// const runDirectory = path.dirname(fileURLToPath(import.meta.url));

const idxRunIdx = process.argv.findIndex((i) => i.endsWith("run.js") || i.endsWith("vibes-diy"));
const runDirectory = path.dirname(fs.realpathSync(process.argv[idxRunIdx]));


const mainJs = path.join(runDirectory, "main.js");
//const mainWithDistJs = path.join(runDirectory, "dist", "npm", "main.js");
//const mainJs = fs.existsSync(mainPublishedJs) ? mainPublishedJs : fs.existsSync(mainWithDistJs) ? mainWithDistJs : undefined;
if (fs.existsSync(mainJs)) {
  // make windows happy file://
  const addFile = `file://${mainJs}`;
  // eslint-disable-next-line no-undef
  import(addFile).catch((e) => console.error(e));
} else {
  const tsxPath = fs.existsSync("./node_modules/.bin/tsx") ? "./node_modules/.bin/tsx" : "tsx";
  const restArgv = process.argv.slice(2);
  // console.log(">>>>>", restArgv, runDirectory)
  exec(tsxPath, [path.join(runDirectory, "main.ts"), ...restArgv], runDirectory);
}
// }
