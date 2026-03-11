import {
  Evento,
  EventoResult,
  EventoType,
  Option,
  Result,
  exception2Result,
  type EventoEnDecoder,
  type EventoHandler,
  type EventoSendProvider,
  type HandleTriggerCtx,
  type ValidateTriggerCtx,
} from "../node_modules/@vibes.diy/use-vibes-base/node_modules/call-ai/node_modules/@adviser/cement/esm/index.js";
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

export interface TimeOutput {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

type TimeValidateCtx = ValidateTriggerCtx<TimeRequest, TimeRequest, TimeResult>;
type TimeHandleCtx = HandleTriggerCtx<TimeRequest, TimeRequest, TimeResult>;

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

const timeEventoEnDecoder: EventoEnDecoder<TimeRequest, TimeRequest> = {
  async encode(input: TimeRequest): Promise<Result<unknown>> {
    return Result.Ok(input);
  },
  async decode(_data: unknown): Promise<Result<TimeRequest>> {
    return Result.Err("decode is not used by CLI time evento");
  },
};

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeResult(value: unknown): value is TimeResult {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "res.cli.time":
      return value.time instanceof Date && (value.format === "txt" || value.format === "json");
    case "res.cli.error":
      return typeof value.message === "string" && (value.code === 1 || value.code === 2);
    default:
      return false;
  }
}

function hasRuntimeErrorResult(results: TimeResult[]): boolean {
  return results.some(function hasRuntimeCode(result) {
    return result.type === "res.cli.error" && result.code === 1;
  });
}

function validateTimeRequest(ctx: TimeValidateCtx): Promise<Result<Option<TimeRequest>>> {
  if (ctx.request?.type === "req.cli.time") {
    return Promise.resolve(Result.Ok(Option.Some(ctx.request)));
  }
  return Promise.resolve(Result.Ok(Option.None()));
}

function validateUsageErrorRequest(ctx: TimeValidateCtx): Promise<Result<Option<TimeRequest>>> {
  if (ctx.request?.type === "req.cli.usage.error") {
    return Promise.resolve(Result.Ok(Option.Some(ctx.request)));
  }
  return Promise.resolve(Result.Ok(Option.None()));
}

function createTimeRequestHandler(timeCtx: TimeCtx): EventoHandler<TimeRequest, TimeRequest, TimeResult> {
  return {
    hash: "time-request-handler",
    validate: validateTimeRequest,
    handle: async function handleTimeRequest(ctx: TimeHandleCtx) {
      if (ctx.validated.type !== "req.cli.time") {
        return Result.Ok(EventoResult.Continue);
      }

      const rNow = exception2Result(function callNow() {
        return timeCtx.now();
      });
      if (rNow.isErr()) {
        return Result.Err(rNow.Err());
      }

      await ctx.send.send(ctx, {
        type: "res.cli.time",
        time: rNow.Ok(),
        format: ctx.validated.format,
      } satisfies TimeResult);
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function createUsageErrorHandler(): EventoHandler<TimeRequest, TimeRequest, TimeResult> {
  return {
    hash: "usage-error-handler",
    validate: validateUsageErrorRequest,
    handle: async function handleUsageError(ctx: TimeHandleCtx) {
      if (ctx.validated.type !== "req.cli.usage.error") {
        return Result.Ok(EventoResult.Continue);
      }

      await ctx.send.send(ctx, {
        type: "res.cli.error",
        message: ctx.validated.message,
        code: 2,
      } satisfies TimeResult);
      return Result.Ok(EventoResult.Stop);
    },
  };
}

function createRuntimeErrorHandler(): EventoHandler<TimeRequest, TimeRequest, TimeResult> {
  return {
    type: EventoType.Error,
    hash: "runtime-error-handler",
    handle: async function handleRuntimeError(ctx: TimeHandleCtx) {
      await ctx.send.send(ctx, {
        type: "res.cli.error",
        message: formatErrorMessage(ctx.error),
        code: 1,
      } satisfies TimeResult);
      return Result.Ok(EventoResult.Continue);
    },
  };
}

export class TimeCollectSendProvider implements EventoSendProvider<TimeRequest, TimeRequest, TimeResult> {
  readonly results: TimeResult[] = [];

  async send<T>(_ctx: TimeHandleCtx, data: unknown): Promise<Result<T>> {
    if (!isTimeResult(data)) {
      return Result.Err("invalid time result payload");
    }
    this.results.push(data);
    return Result.Ok(data as T);
  }
}

export function setupTimeCtx(overrides?: Partial<TimeCtx>): TimeCtx {
  return {
    now: overrides?.now ?? function defaultNow(): Date {
      return new Date();
    },
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

export function createTimeEvento(ctx: TimeCtx): Evento {
  const evento = new Evento(timeEventoEnDecoder);
  evento.push(createTimeRequestHandler(ctx), createUsageErrorHandler(), createRuntimeErrorHandler());
  return evento;
}

export function processLineOutput(output: TimeOutput, results: TimeResult[]): number {
  let code = 0;

  for (const result of results) {
    switch (result.type) {
      case "res.cli.time":
        if (result.format === "json") {
          output.out(`${JSON.stringify({ type: result.type, time: result.time.toISOString() })}\n`);
        } else {
          output.out(`${result.time.getUTCFullYear()}\n`);
        }
        break;
      case "res.cli.error":
        output.err(`Error: ${result.message}\n`);
        code = Math.max(code, result.code);
        break;
    }
  }

  return code;
}

export async function runTimePipeline(argv: string[], ctx: TimeCtx, output: TimeOutput): Promise<number> {
  const req = await parseCLIToReq(argv);
  const sendProvider = new TimeCollectSendProvider();
  const evento = createTimeEvento(ctx);
  const rTrigger = await evento.trigger({ request: req, send: sendProvider });

  if (rTrigger.isErr()) {
    sendProvider.results.push({
      type: "res.cli.error",
      message: formatErrorMessage(rTrigger.Err()),
      code: 1,
    });
    return processLineOutput(output, sendProvider.results);
  }

  const triggerCtx = rTrigger.Ok();

  for (const sendItem of triggerCtx.stats.send.items) {
    if (sendItem.item.isErr()) {
      sendProvider.results.push({
        type: "res.cli.error",
        message: formatErrorMessage(sendItem.item.Err()),
        code: 1,
      });
    }
  }

  if (triggerCtx.error && !hasRuntimeErrorResult(sendProvider.results)) {
    sendProvider.results.push({
      type: "res.cli.error",
      message: formatErrorMessage(triggerCtx.error),
      code: 1,
    });
  }

  return processLineOutput(output, sendProvider.results);
}
