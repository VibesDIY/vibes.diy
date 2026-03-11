import { command, flag, runSafely, subcommands } from "cmd-ts";

export type OutputFormat = "txt" | "json";

export type TimeRequest =
  | { readonly type: "req.cli.time"; readonly format: OutputFormat }
  | { readonly type: "req.cli.usage.error"; readonly message: string };

export type TimeResult =
  | { readonly type: "res.cli.time"; readonly time: Date; readonly format: OutputFormat }
  | { readonly type: "res.cli.error"; readonly message: string; readonly code: 1 | 2 };

export interface TimeCtx {
  readonly now: () => Date;
}

export interface TimeHandlerIo {
  readonly send: (result: TimeResult) => void;
}

export interface TimeOutput {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

const timeCommand = command({
  name: "time",
  args: {
    json: flag({
      long: "json",
      description: "Output result as JSON",
    }),
    txt: flag({
      long: "txt",
      description: "Output result as plain text",
    }),
  },
  handler: function handleArgs(args) {
    return args;
  },
});

const cliParser = subcommands({
  name: "use-vibes",
  cmds: {
    time: timeCommand,
  },
});

export function setupTimeCtx(overrides?: Partial<TimeCtx>): TimeCtx {
  function defaultNow(): Date {
    return new Date();
  }

  return {
    now: overrides?.now ?? defaultNow,
  };
}

export function triggerTimeHandler(ctx: TimeCtx) {
  return function handleRequest(req: TimeRequest, io: TimeHandlerIo): void {
    switch (req.type) {
      case "req.cli.time":
        io.send({
          type: "res.cli.time",
          time: ctx.now(),
          format: req.format,
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

export async function parseCLIToReq(argv: string[]): Promise<TimeRequest> {
  const parsed = await runSafely(cliParser, [...argv]);
  if (parsed._tag === "error") {
    return {
      type: "req.cli.usage.error",
      message: parsed.error.config.message.trim(),
    };
  }

  const { json, txt } = parsed.value.value;
  if (json && txt) {
    return {
      type: "req.cli.usage.error",
      message: "Use either --json or --txt, not both",
    };
  }

  return {
    type: "req.cli.time",
    format: json ? "json" : "txt",
  };
}

export function formatTimeResult(result: {
  readonly type: "res.cli.time";
  readonly time: Date;
  readonly format: OutputFormat;
}): string {
  if (result.format === "json") {
    return `${JSON.stringify({ time: result.time.toISOString() })}\n`;
  }
  return `${result.time.toISOString()}\n`;
}

export function processLineOutput(
  output: TimeOutput,
  results: TimeResult[],
): number {
  let code = 0;
  for (const result of results) {
    switch (result.type) {
      case "res.cli.time":
        output.out(formatTimeResult(result));
        break;
      case "res.cli.error":
        output.err(`Error: ${result.message}\n`);
        code = Math.max(code, result.code);
        break;
    }
  }
  return code;
}

export async function runTimePipeline(
  argv: string[],
  ctx: TimeCtx,
  output: TimeOutput,
): Promise<number> {
  const req = await parseCLIToReq(argv);
  const results: TimeResult[] = [];

  function sendResult(result: TimeResult): void {
    results.push(result);
  }

  triggerTimeHandler(ctx)(req, {
    send: sendResult,
  });
  return processLineOutput(output, results);
}
