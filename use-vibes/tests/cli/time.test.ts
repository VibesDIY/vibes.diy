import { describe, expect, it } from "vitest";
import {
  formatTimeResult,
  parseCLIToReq,
  processLineOutput,
  runTimePipeline,
  setupTimeCtx,
  triggerTimeHandler,
  type TimeResult,
} from "../../pkg/cli/time.js";

interface CapturedOutput {
  readonly outLines: string[];
  readonly errLines: string[];
  readonly output: {
    out(line: string): void;
    err(line: string): void;
  };
}

function createCapturedOutput(): CapturedOutput {
  const outLines: string[] = [];
  const errLines: string[] = [];

  return {
    outLines,
    errLines,
    output: {
      out(line: string): void {
        outLines.push(line);
      },
      err(line: string): void {
        errLines.push(line);
      },
    },
  };
}

describe("time handler", () => {
  it("emits res.cli.time for req.cli.time", () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const ctx = setupTimeCtx({
      now: function nowFn() {
        return now;
      },
    });
    const events: TimeResult[] = [];

    function send(result: TimeResult): void {
      events.push(result);
    }

    triggerTimeHandler(ctx)({ type: "req.cli.time", format: "txt" }, { send });

    expect(events).toEqual([{ type: "res.cli.time", time: now, format: "txt" }]);
  });

  it("emits res.cli.error for usage errors", () => {
    const ctx = setupTimeCtx();
    const events: TimeResult[] = [];

    function send(result: TimeResult): void {
      events.push(result);
    }

    triggerTimeHandler(ctx)(
      { type: "req.cli.usage.error", message: "bad flag" },
      { send },
    );

    expect(events).toEqual([
      { type: "res.cli.error", message: "bad flag", code: 2 },
    ]);
  });
});

describe("time flag parsing", () => {
  it("parses [time] to txt request", async () => {
    const req = await parseCLIToReq(["time"]);
    expect(req).toEqual({ type: "req.cli.time", format: "txt" });
  });

  it("parses [time --json] to json request", async () => {
    const req = await parseCLIToReq(["time", "--json"]);
    expect(req).toEqual({ type: "req.cli.time", format: "json" });
  });

  it("parses [time --txt] to txt request", async () => {
    const req = await parseCLIToReq(["time", "--txt"]);
    expect(req).toEqual({ type: "req.cli.time", format: "txt" });
  });

  it("maps --json --txt conflict to usage error", async () => {
    const req = await parseCLIToReq(["time", "--json", "--txt"]);
    expect(req).toEqual({
      type: "req.cli.usage.error",
      message: "Use either --json or --txt, not both",
    });
  });

  it("maps unknown flag to usage error", async () => {
    const req = await parseCLIToReq(["time", "--wat"]);
    expect(req.type).toBe("req.cli.usage.error");
    if (req.type === "req.cli.usage.error") {
      expect(req.message).toContain("Unknown arguments");
    }
  });
});

describe("time formatter", () => {
  it("formats txt as year", () => {
    const line = formatTimeResult({
      type: "res.cli.time",
      time: new Date("2024-01-01T00:00:00.000Z"),
      format: "txt",
    });
    expect(line).toBe("2024-01-01T00:00:00.000Z\n");
  });

  it("formats json as ISO object", () => {
    const line = formatTimeResult({
      type: "res.cli.time",
      time: new Date("2024-01-01T00:00:00.000Z"),
      format: "json",
    });
    expect(line).toBe(
      '{"time":"2024-01-01T00:00:00.000Z"}\n',
    );
  });
});

describe("time output serializer", () => {
  it("serializes txt output and returns exit 0", () => {
    const captured = createCapturedOutput();
    const code = processLineOutput(captured.output, [
      { type: "res.cli.time", time: new Date("2024-01-01T00:00:00.000Z"), format: "txt" },
    ]);

    expect(captured.outLines).toEqual(["2024-01-01T00:00:00.000Z\n"]);
    expect(captured.errLines).toEqual([]);
    expect(code).toBe(0);
  });

  it("serializes json output and returns exit 0", () => {
    const captured = createCapturedOutput();
    const code = processLineOutput(captured.output, [
      { type: "res.cli.time", time: new Date("2024-01-01T00:00:00.000Z"), format: "json" },
    ]);

    expect(captured.outLines).toEqual([
      '{"time":"2024-01-01T00:00:00.000Z"}\n',
    ]);
    expect(captured.errLines).toEqual([]);
    expect(code).toBe(0);
  });

  it("serializes errors to stderr and returns exit 2", () => {
    const captured = createCapturedOutput();
    const code = processLineOutput(captured.output, [
      { type: "res.cli.error", message: "bad args", code: 2 },
    ]);

    expect(captured.outLines).toEqual([]);
    expect(captured.errLines).toEqual(["Error: bad args\n"]);
    expect(code).toBe(2);
  });
});

describe("time pipeline", () => {
  it("runs parse -> handler -> serializer success path", async () => {
    const captured = createCapturedOutput();
    const ctx = setupTimeCtx({
      now: function nowFn() {
        return new Date("2024-01-01T00:00:00.000Z");
      },
    });
    const code = await runTimePipeline(["time"], ctx, captured.output);

    expect(captured.outLines).toEqual(["2024-01-01T00:00:00.000Z\n"]);
    expect(captured.errLines).toEqual([]);
    expect(code).toBe(0);
  });

  it("runs parse -> handler -> serializer usage-error path", async () => {
    const captured = createCapturedOutput();
    const ctx = setupTimeCtx();
    const code = await runTimePipeline(["time", "--wat"], ctx, captured.output);

    expect(captured.outLines).toEqual([]);
    expect(captured.errLines[0]).toContain("Error:");
    expect(captured.errLines[0]).toContain("Unknown arguments");
    expect(code).toBe(2);
  });
});
