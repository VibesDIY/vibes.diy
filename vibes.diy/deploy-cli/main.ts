import { CliCtx, createCliStream, runCli } from "@vibes.diy/cmd-harness";

import { isResWriteEnv, writeEnvCmd, writeEnvEvento } from "./cmds/write-env-cmd.js";

async function main() {
  const ctx: CliCtx = {
    cliStream: createCliStream(),
  };

  await runCli({
    name: "deploy-cli",
    description: "@vibes.diy/deploy-cli",
    ctx,
    cmds: {
      writeEnv: writeEnvCmd(ctx),
    },
    handlers: [writeEnvEvento],
    renderResult: (msg) => {
      if (isResWriteEnv(msg) && msg.output) {
        console.log(msg.output);
      }
    },
  });
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("Error in deploy-cli:", e);
    process.exit(1);
  }
);
