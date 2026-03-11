import { describe, expect, it, vi } from "vitest";
import {
  createTimeEvento,
  parseCLIToReq,
  processLineOutput,
  runTimePipeline,
  setupTimeCtx,
  TimeCollectSendProvider,
} from "../../pkg/cli/time.js";

describe("parseCLIToReq", () => {
  it("parses [time] to req.cli.time with txt format", async () => {
    const req = await parseCLIToReq(["time"]);
    expect(req).toEqual({ type: "req.cli.time", format: "txt" });
  });

  it("parses [time --json] to req.cli.time with json format", async () => {
    const req = await parseCLIToReq(["time", "--json"]);
    expect(req).toEqual({ type: "req.cli.time", format: "json" });
  });

  it("parses [time --txt] to req.cli.time with txt format", async () => {
    const req = await parseCLIToReq(["time", "--txt"]);
    expect(req).toEqual({ type: "req.cli.time", format: "txt" });
  });

  it("maps conflicting flags to req.cli.usage.error", async () => {
    const req = await parseCLIToReq(["time", "--json", "--txt"]);
    expect(req).toEqual({
      type: "req.cli.usage.error",
      message: "Use either --json or --txt, not both",
    });
  });

  it("maps invalid option to req.cli.usage.error", async () => {
    const req = await parseCLIToReq(["time", "--wat"]);
    expect(req.type).toBe("req.cli.usage.error");
    if (req.type === "req.cli.usage.error") {
      expect(req.message).toContain("Unknown arguments");
    }
  });

  it("maps unknown command to req.cli.usage.error", async () => {
    const req = await parseCLIToReq(["wat"]);
    expect(req.type).toBe("req.cli.usage.error");
  });
});

describe("createTimeEvento", () => {
  it("handles req.cli.time and emits res.cli.time", async () => {
    const fixed = new Date("2024-01-01T00:00:00.000Z");
    const evento = createTimeEvento(
      setupTimeCtx({
        now: () => fixed,
      }),
    );
    const send = new TimeCollectSendProvider();

    const rTrigger = await evento.trigger({
      request: { type: "req.cli.time", format: "txt" },
      send,
    });

    expect(rTrigger.isOk()).toBe(true);
    expect(send.results).toEqual([{ type: "res.cli.time", time: fixed, format: "txt" }]);
  });

  it("handles req.cli.usage.error and emits res.cli.error code 2", async () => {
    const evento = createTimeEvento(setupTimeCtx());
    const send = new TimeCollectSendProvider();

    const rTrigger = await evento.trigger({
      request: { type: "req.cli.usage.error", message: "bad args" },
      send,
    });

    expect(rTrigger.isOk()).toBe(true);
    expect(send.results).toEqual([{ type: "res.cli.error", message: "bad args", code: 2 }]);
  });
});

describe("processLineOutput", () => {
  it("writes txt time format and returns 0", () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const code = processLineOutput(output, [
      { type: "res.cli.time", format: "txt", time: new Date("2024-01-01T00:00:00.000Z") },
    ]);

    expect(output.out).toHaveBeenCalledWith("2024\n");
    expect(output.err).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  it("writes json time format and returns 0", () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const code = processLineOutput(output, [
      { type: "res.cli.time", format: "json", time: new Date("2024-01-01T00:00:00.000Z") },
    ]);

    expect(output.out).toHaveBeenCalledWith(
      '{"type":"res.cli.time","time":"2024-01-01T00:00:00.000Z"}\n',
    );
    expect(output.err).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  it("writes stderr for error result and returns 2", () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const code = processLineOutput(output, [
      { type: "res.cli.error", message: "bad args", code: 2 },
    ]);

    expect(output.err).toHaveBeenCalledWith("Error: bad args\n");
    expect(code).toBe(2);
  });
});

describe("runTimePipeline", () => {
  it("success path with txt output", async () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const ctx = setupTimeCtx({
      now: () => new Date("2024-01-01T00:00:00.000Z"),
    });

    const code = await runTimePipeline(["time"], ctx, output);

    expect(output.out).toHaveBeenCalledWith("2024\n");
    expect(output.err).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  it("success path with json output", async () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const ctx = setupTimeCtx({
      now: () => new Date("2024-01-01T00:00:00.000Z"),
    });

    const code = await runTimePipeline(["time", "--json"], ctx, output);

    expect(output.out).toHaveBeenCalledWith(
      '{"type":"res.cli.time","time":"2024-01-01T00:00:00.000Z"}\n',
    );
    expect(output.err).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  it("usage error path returns code 2", async () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const ctx = setupTimeCtx();

    const code = await runTimePipeline(["time", "--wat"], ctx, output);

    expect(output.out).not.toHaveBeenCalled();
    expect(output.err).toHaveBeenCalled();
    expect(code).toBe(2);
  });

  it("runtime error path returns code 1", async () => {
    const output = { out: vi.fn(), err: vi.fn() };
    const ctx = setupTimeCtx({
      now: () => {
        throw new Error("boom");
      },
    });

    const code = await runTimePipeline(["time"], ctx, output);

    expect(output.err).toHaveBeenCalledWith("Error: boom\n");
    expect(code).toBe(1);
  });
});
