import { describe, expect, it, vi } from "vitest";
import {
  parseCLIToReq,
  processLineOutput,
  runPrintTimePipeline,
  setupPrintTimeCtx,
  triggerHandler,
} from "../../pkg/cli/time.js";

describe("handler", () => {
  it("print.time sends current time", () => {
    const ctx = setupPrintTimeCtx({
      now: () => new Date("2024-01-01T00:00:00.000Z"),
    });
    const send = vi.fn();

    triggerHandler(ctx)({ type: "req.cli.print.time" }, { send });

    expect(send).toHaveBeenCalledWith({
      type: "res.cli.print.time",
      time: expect.any(Date),
    });
  });

  it("usage error sends error with code 2", () => {
    const ctx = setupPrintTimeCtx();
    const send = vi.fn();

    triggerHandler(ctx)(
      { type: "req.cli.usage.error", message: "bad flag" },
      { send },
    );

    expect(send).toHaveBeenCalledWith({
      type: "res.cli.error",
      message: "bad flag",
      code: 2,
    });
  });
});

describe("parse", () => {
  it("parses [print --time] to print.time request", async () => {
    const req = await parseCLIToReq(["print", "--time"]);
    expect(req).toEqual({ type: "req.cli.print.time" });
  });

  it("maps [print] without --time to usage error", async () => {
    const req = await parseCLIToReq(["print"]);
    expect(req).toEqual({
      type: "req.cli.usage.error",
      message: "Missing required flag: --time",
    });
  });

  it("maps unknown flag to usage error", async () => {
    const req = await parseCLIToReq(["print", "--wat"]);
    expect(req.type).toBe("req.cli.usage.error");
  });
});

describe("output", () => {
  it("formats time to stdout", () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const code = processLineOutput(output, [
      { type: "res.cli.print.time", time: new Date("2024-01-01T00:00:00.000Z") },
    ]);

    expect(output.out).toHaveBeenCalledWith("2024-01-01T00:00:00.000Z\n");
    expect(code).toBe(0);
  });

  it("formats error to stderr exit 2", () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const code = processLineOutput(output, [
      { type: "res.cli.error", message: "bad args", code: 2 },
    ]);

    expect(output.err).toHaveBeenCalledWith("Error: bad args\n");
    expect(code).toBe(2);
  });
});

describe("pipeline", () => {
  it("print --time end to end", async () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const ctx = setupPrintTimeCtx({
      now: () => new Date("2024-01-01T00:00:00.000Z"),
    });
    const code = await runPrintTimePipeline(["print", "--time"], ctx, output);

    expect(output.out).toHaveBeenCalledWith("2024-01-01T00:00:00.000Z\n");
    expect(code).toBe(0);
  });

  it("print --wat returns usage error", async () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const ctx = setupPrintTimeCtx();
    const code = await runPrintTimePipeline(["print", "--wat"], ctx, output);

    expect(output.err).toHaveBeenCalled();
    expect(code).toBe(2);
  });
});
