import { describe, expect, it } from "vitest";
import { EventoHandler, EventoResult, Result } from "@adviser/cement";
import { admissionGated } from "@vibes.diy/api-svc/shard-gate.js";
import { SHARD_OVERLOADED_CODE, type CodegenAdmission } from "@vibes.diy/api-types";

// Codegen-DO admission control. `admissionGated` wraps the heavy stream handler so
// a single DO admits at most `limit` concurrent streams; the next gets a coded
// `shard-overloaded` ResError and the handler never runs. The counter is shared by
// reference (per-DO-instance), and decremented on EVERY exit path (completion,
// error, mid-stream close) so a slot frees up for the next stream.

interface Deferred {
  promise: Promise<Result<unknown>>;
  resolve: () => void;
  reject: (e: unknown) => void;
}
function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Result<unknown>>((res, rej) => {
    resolve = () => res(Result.Ok(EventoResult.Continue));
    reject = (e: unknown) => rej(e);
  });
  return { promise, resolve, reject };
}

// A fake handler whose `handle` blocks on a per-call deferred so we can hold
// streams "in flight" and assert concurrent admission. Records how many times the
// inner handler actually ran (admission rejections must NOT call it).
function makeHandler() {
  const calls: Deferred[] = [];
  const handler: EventoHandler = {
    hash: "fake-stream",
    handle: () => {
      const d = deferred();
      calls.push(d);
      return d.promise as Promise<Result<typeof EventoResult.Continue>>;
    },
  } as unknown as EventoHandler;
  return { handler, calls };
}

// Minimal ctx: a Map-backed `ctx.get`, an `enRequest` (for the dry-run probe), and
// a `send.send` that records emitted messages.
function makeCtx(adm: CodegenAdmission | undefined, opts?: { dryRun?: boolean }) {
  const sent: { type: string; error?: { code?: string } }[] = [];
  const ctx = {
    ctx: { get: (k: string) => (k === "codegenAdmission" ? adm : undefined) },
    enRequest: { payload: { dryRun: opts?.dryRun ?? false } },
    send: {
      send: async (_c: unknown, msg: { type: string; error?: { code?: string } }) => {
        sent.push(msg);
        return Result.Ok();
      },
    },
  };
  return { ctx, sent };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("admissionGated", () => {
  it("passes through unchanged when no admission holder (vibe/shared/test plane)", async () => {
    const { handler, calls } = makeHandler();
    const gated = admissionGated(handler);
    const { ctx, sent } = makeCtx(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void gated.handle(ctx as any);
    await tick();
    expect(calls).toHaveLength(1); // inner ran
    expect(sent).toHaveLength(0); // nothing rejected
  });

  it("admits up to the limit, rejects the next with shard-overloaded, and frees a slot on completion", async () => {
    const { handler, calls } = makeHandler();
    const gated = admissionGated(handler);
    const adm: CodegenAdmission = { active: 0, limit: 3 };

    // Fire 3 concurrent streams — all admitted, all in flight.
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void gated.handle(makeCtx(adm).ctx as any);
    }
    await tick();
    expect(calls).toHaveLength(3);
    expect(adm.active).toBe(3);

    // The 4th is rejected: inner handler does NOT run, a shard-overloaded error is sent.
    const fourth = makeCtx(adm);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await gated.handle(fourth.ctx as any);
    expect(r.isOk()).toBe(true);
    expect(calls).toHaveLength(3); // unchanged — handler never ran
    expect(fourth.sent).toHaveLength(1);
    expect(fourth.sent[0].type).toBe("vibes.diy.res-error");
    expect(fourth.sent[0].error?.code).toBe(SHARD_OVERLOADED_CODE);
    expect(adm.active).toBe(3);

    // Complete one stream → slot frees.
    calls[0].resolve();
    await tick();
    expect(adm.active).toBe(2);

    // A new stream is admitted again.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void gated.handle(makeCtx(adm).ctx as any);
    await tick();
    expect(calls).toHaveLength(4);
    expect(adm.active).toBe(3);
  });

  it("decrements on handler error too (no slot leak)", async () => {
    const { handler, calls } = makeHandler();
    const gated = admissionGated(handler);
    const adm: CodegenAdmission = { active: 0, limit: 1 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = gated.handle(makeCtx(adm).ctx as any);
    await tick();
    expect(adm.active).toBe(1);

    // The in-flight stream throws (e.g. mid-stream WS close) — finally must still fire.
    calls[0].reject(new Error("mid-stream close"));
    await expect(p).rejects.toThrow("mid-stream close");
    expect(adm.active).toBe(0);
  });

  it("does not count dry-runs against the budget", async () => {
    const { handler, calls } = makeHandler();
    const gated = admissionGated(handler);
    const adm: CodegenAdmission = { active: 0, limit: 1 };

    // A dry-run passes through without touching the counter...
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void gated.handle(makeCtx(adm, { dryRun: true }).ctx as any);
    await tick();
    expect(calls).toHaveLength(1);
    expect(adm.active).toBe(0); // dry-run did not consume a slot

    // ...so a real stream is still admitted at limit=1.
    const real = makeCtx(adm);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void gated.handle(real.ctx as any);
    await tick();
    expect(calls).toHaveLength(2);
    expect(real.sent).toHaveLength(0);
    expect(adm.active).toBe(1);
  });
});
