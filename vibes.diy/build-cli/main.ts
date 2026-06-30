import { CliCtx, createCliStream, loadCliEnv, runCli } from "@vibes.diy/cmd-harness";

import { buildCmd, buildEvento, isResBuild } from "./cmds/build-cmd.js";
import { handleTsc, tscCmd, tscEvento, isResTsc } from "./cmds/tsc-cmd.js";

async function main() {
  // Load .env / FP_ENV before the tsc bypass so an FP_TSC override set via .env
  // is honored for `core-cli tsc` — the bypass returns before runCli (which also
  // loads it) would get the chance. loadCliEnv is idempotent.
  loadCliEnv();

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
