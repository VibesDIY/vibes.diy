// Slice B4 (#2856): queue worker retry boundary. Regression test for the bug
// Charlie flagged on PR #2912: in our pinned `@adviser/cement`, a handler that
// returns `Result.Err` is recorded on `stepCtx.error` and the `EventoType.Error`
// handlers run, but `Evento.trigger` still returns `Result.Ok(stepCtx)`. So the
// worker must NOT key its ack/retry decision on `rTrigger.isErr()` alone — a
// failed `/arm` poke would be acked and lost. `shouldRetryTrigger` is the guard.

import { describe, expect, it } from "vitest";
import {
  AppContext,
  Evento,
  EventoHandler,
  EventoResult,
  EventoResultType,
  EventoSendProvider,
  EventoType,
  HandleTriggerCtx,
  Option,
  Result,
} from "@adviser/cement";
import { MsgBaseEventoEnDecoder } from "@vibes.diy/api-pkg";
import { shouldRetryTrigger } from "../queue/worker.js";

class NoopSend implements EventoSendProvider<unknown, unknown, unknown> {
  async send<T>(): Promise<Result<T>> {
    return Result.Ok();
  }
}

// A handler that always matches and returns the configured Result. Mirrors the
// shape of the real queue handlers (validate → handle).
function handler(hash: string, result: Result<EventoResultType>): EventoHandler<unknown, unknown, void> {
  return {
    hash,
    validate: async (ctx) => Result.Ok(Option.Some(ctx.enRequest)),
    handle: async (_ctx: HandleTriggerCtx<unknown, unknown, void>) => result,
  };
}

// Build an Evento that registers the supplied regular handler plus the same
// `EventoType.Error` handler the real queue uses, so we exercise the genuine
// error-capture path (not a stub).
function queueLike(regular: EventoHandler<unknown, unknown, void>): Evento {
  const evento = new Evento(new MsgBaseEventoEnDecoder());
  evento.push(regular, {
    type: EventoType.Error,
    hash: "queue-error-handler",
    handle: async () => Result.Ok(EventoResult.Continue),
  });
  return evento;
}

async function run(regular: EventoHandler<unknown, unknown, void>) {
  const evento = queueLike(regular);
  const ctx = new AppContext();
  return evento.trigger({ ctx, send: new NoopSend(), request: JSON.stringify({ type: "demo" }) });
}

describe("queue worker retry boundary (#2856 B4)", () => {
  it("a handler-returned Err is captured on stepCtx.error but trigger still returns Ok", async () => {
    const rTrigger = await run(handler("boom", Result.Err("poke failed")));
    // This is the trap: the failure does NOT show up as an Err result.
    expect(rTrigger.isErr()).toBe(false);
    expect(rTrigger.Ok().error).toBeDefined();
  });

  it("shouldRetryTrigger → true when a handler recorded an error (the regression)", async () => {
    const rTrigger = await run(handler("boom", Result.Err("poke failed")));
    expect(shouldRetryTrigger(rTrigger)).toBe(true);
  });

  it("shouldRetryTrigger → false when every handler succeeded", async () => {
    const rTrigger = await run(handler("ok", Result.Ok(EventoResult.Continue)));
    expect(rTrigger.isErr()).toBe(false);
    expect(rTrigger.Ok().error).toBeUndefined();
    expect(shouldRetryTrigger(rTrigger)).toBe(false);
  });

  it("shouldRetryTrigger → true when trigger itself returns Err", () => {
    expect(shouldRetryTrigger(Result.Err("transport blew up"))).toBe(true);
  });
});
