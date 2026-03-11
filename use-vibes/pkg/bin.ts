#!/usr/bin/env node

import process from "node:process";
import { defaultCliOutput } from "./commands/cli-output-node.js";
import { dispatch } from "./dispatcher.js";

await dispatch(process.argv.slice(2), {
  cwd: process.cwd(),
  output: defaultCliOutput,
  setExitCode(code: number): void {
    process.exitCode = code;
  },
});
