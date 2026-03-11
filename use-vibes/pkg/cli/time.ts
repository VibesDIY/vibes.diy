import { command, flag, runSafely, subcommands } from "cmd-ts";

export type OutputFormat = "txt" | "json";

export type PrintTimeRequest =
  | { readonly type: "req.cli.print.time" }
  | { readonly type: "req.cli.usage.error"; readonly message: string };

export type PrintTimeResult =
  | { readonly type: "res.cli.print.time"; readonly time: Date }
  | { readonly type: "res.cli.error"; readonly message: string; readonly code: 1 | 2 };

export interface PrintTimeCtx {
  readonly now: () => Date;
}

export interface PrintTimeOutput {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const printCommand = command({
  name: "print",
  args: {
    time: flag({
      long: "time",
      description: "Print the current time",
    }),
  },
  handler: function handleArgs(args) {
    return args;
  },
});

const cliParser = subcommands({
  name: "use-vibes",
  cmds: {
    print: printCommand,
  },
});

export function setupPrintTimeCtx(overrides?: Partial<PrintTimeCtx>): PrintTimeCtx {
  return {
    now: overrides?.now ?? function defaultNow(): Date {
      return new Date();
    },
  };
}

export function triggerHandler(ctx: PrintTimeCtx) {
  return function handleRequest(
    req: PrintTimeRequest,
    io: { readonly send: (result: PrintTimeResult) => void },
  ): void {
    switch (req.type) {
      case "req.cli.print.time":
        io.send({
          type: "res.cli.print.time",
          time: ctx.now(),
        });
        return;
      case "req.cli.usage.error":
        io.send({
          type: "res.cli.error",
          message: req.message,
          code: 2,
        });
        return;
    }
  };
}

export async function parseCLIToReq(argv: readonly string[]): Promise<PrintTimeRequest> {
  const parsed = await runSafely(cliParser, [...argv]);
  if (parsed._tag === "error") {
    return {
      type: "req.cli.usage.error",
      message: parsed.error.config.message.trim(),
    };
  }

  const { time } = parsed.value.value;
  if (!time) {
    return {
      type: "req.cli.usage.error",
      message: "Missing required flag: --time",
    };
  }

  return { type: "req.cli.print.time" };
}

export function processLineOutput(
  output: PrintTimeOutput,
  results: readonly PrintTimeResult[],
): number {
  let code = 0;
  for (const result of results) {
    switch (result.type) {
      case "res.cli.print.time":
        output.out(`${result.time.toISOString()}\n`);
        break;
      case "res.cli.error":
        output.err(`Error: ${result.message}\n`);
        code = Math.max(code, result.code);
        break;
    }
  }
  return code;
}

export async function runPrintTimePipeline(
  argv: readonly string[],
  ctx: PrintTimeCtx,
  output: PrintTimeOutput,
): Promise<number> {
  const req = await parseCLIToReq(argv);
  let code = 0;

  triggerHandler(ctx)(req, {
    send: function sendResult(result: PrintTimeResult): void {
      code = Math.max(code, processLineOutput(output, [result]));
    },
  });
  return code;
}
