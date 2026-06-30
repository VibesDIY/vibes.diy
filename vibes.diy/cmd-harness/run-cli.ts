import { AppContext, EventoHandler, EventoSendProvider, HandleTriggerCtx, processStream, Result } from "@adviser/cement";
import { dotenv } from "zx";
import { runSafely, subcommands } from "cmd-ts";
import { err, isErr } from "cmd-ts/dist/cjs/Result.js";
import { isCmdProgress, WrapCmdTSMsg } from "@vibes.diy/cmd-tools";

import { CliCtx } from "./cli-ctx.js";
import { makeCmdTsEvento } from "./cmd-evento.js";

export class OutputSelector implements EventoSendProvider<unknown, unknown, unknown> {
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

export interface RunCliOptions {
  readonly name: string;
  readonly description: string;
  readonly version?: string;
  readonly ctx: CliCtx;
  readonly cmds: Parameters<typeof subcommands>[0]["cmds"];
  readonly handlers: EventoHandler<WrapCmdTSMsg<unknown>, unknown, unknown>[];
  // Render a non-progress command result. Each CLI knows its own result types;
  // progress messages are handled centrally here.
  readonly renderResult: (msg: unknown) => void;
}

// The shared cmd-ts run loop: parse argv into a queued request, drive it through
// the evento bus, and stream progress + the final result back to the console.
// Used by every command CLI in the monorepo (build-cli, deploy-cli, …) so the
// streaming plumbing lives in exactly one place.
export async function runCli(opts: RunCliOptions): Promise<void> {
  dotenv.config(process.env.FP_ENV ?? ".env");

  const rs = await runSafely(
    subcommands({
      name: opts.name,
      description: opts.description,
      version: opts.version ?? "1.0.0",
      cmds: opts.cmds,
    }),
    process.argv.slice(2)
  );
  if (isErr(rs)) {
    console.error(err(rs).error.error.config.message);
    process.exit(err(rs).error.error.config.exitCode);
  }

  const outputSelector = new OutputSelector();
  const evento = makeCmdTsEvento(opts.handlers);
  const appCtx = new AppContext().set("cliCtx", opts.ctx);

  await Promise.all([
    processStream(
      opts.ctx.cliStream.stream,
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
        opts.renderResult(msg);
      })
    ),
    opts.ctx.cliStream.close(),
  ]);
}
