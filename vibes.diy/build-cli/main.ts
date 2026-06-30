import { CliCtx, createCliStream, runCli } from "@vibes.diy/cmd-harness";

import { buildCmd, buildEvento, isResBuild } from "./cmds/build-cmd.js";
import { handleTsc, tscCmd, tscEvento, isResTsc } from "./cmds/tsc-cmd.js";

async function main() {
  // tsc bypass: called directly before cmd-ts runs
  if (process.argv[2] === "tsc") {
    return handleTsc(process.argv.slice(3));
  }

  const ctx: CliCtx = {
    cliStream: createCliStream(),
  };

  await runCli({
    name: "core-cli",
    description: "@vibes.diy/build-cli",
    ctx,
    cmds: {
      tsc: tscCmd(ctx),
      build: buildCmd(ctx),
    },
    handlers: [tscEvento, buildEvento],
    renderResult: (msg) => {
      if ((isResTsc(msg) || isResBuild(msg)) && msg.output) {
        console.log(msg.output);
      }
    },
  });
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("Error in core-cli:", e);
    process.exit(1);
  }
);
