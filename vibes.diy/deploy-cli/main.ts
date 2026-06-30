import { AppContext, EventoSendProvider, HandleTriggerCtx, processStream, Result } from "@adviser/cement";
import { dotenv } from "zx";
import { runSafely, subcommands } from "cmd-ts";
import { err, isErr } from "cmd-ts/dist/cjs/Result.js";

import { createCliStream } from "./create-cli-stream.js";
import { CliCtx } from "./cli-ctx.js";
import { cmdTsEvento, isCmdProgress, WrapCmdTSMsg } from "./cmd-evento.js";

import { writeEnvCmd, isResWriteEnv } from "./cmds/write-env-cmd.js";

class OutputSelector implements EventoSendProvider<unknown, unknown, unknown> {
  readonly tstream = new TransformStream<unknown, WrapCmdTSMsg<unknown>>();
  readonly outputStream: ReadableStream<WrapCmdTSMsg<unknown>> = this.tstream.readable;
  readonly writer = this.tstream.writable.getWriter();
  async send<IS, OS>(_trigger: HandleTriggerCtx<unknown, unknown, unknown>, data: IS): Promise<Result<OS, Error>> {
    await this.writer.write(data);
    return Promise.resolve(Result.Ok());
  }
  done(_trigger: HandleTriggerCtx<unknown, unknown, unknown>): Promise<Result<void>> {
    this.writer.releaseLock();
    this.tstream.writable.close();
    return Promise.resolve(Result.Ok());
  }
}

async function main() {
  dotenv.config(process.env.FP_ENV ?? ".env");

  const ctx: CliCtx = {
    cliStream: createCliStream(),
  };

  const rs = await runSafely(
    subcommands({
      name: "deploy-cli",
      description: "@vibes.diy/deploy-cli",
      version: "1.0.0",
      cmds: {
        writeEnv: writeEnvCmd(ctx),
      },
    }),
    process.argv.slice(2)
  );
  if (isErr(rs)) {
    console.error(err(rs).error.error.config.message);
    process.exit(err(rs).error.error.config.exitCode);
  }

  const outputSelector = new OutputSelector();
  const evento = cmdTsEvento();
  const appCtx = new AppContext().set("cliCtx", ctx);

  await Promise.all([
    processStream(
      ctx.cliStream.stream,
      async (msg) => {
        const triggered = await evento.trigger({
          ctx: appCtx,
          send: outputSelector,
          request: msg,
        });
        if (triggered.isErr()) {
          throw triggered.Err();
        }
        const triggerCtx = triggered.unwrap();
        if (triggerCtx.error) {
          throw triggerCtx.error;
        }
      },
      processStream(outputSelector.outputStream, async (wmsg) => {
        const msg = wmsg.result;
        if (isCmdProgress(msg)) {
          switch (msg.level) {
            case "warn":
              console.warn(msg.message);
              break;
            case "error":
              console.error(msg.message);
              break;
            case "info":
            default:
              console.log(msg.message);
              break;
          }
          return;
        }
        switch (true) {
          case isResWriteEnv(msg): {
            if (msg.output) {
              console.log(msg.output);
            }
            break;
          }
        }
      })
    ),
    ctx.cliStream.close(),
  ]);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("Error in deploy-cli:", e);
    process.exit(1);
  }
);
