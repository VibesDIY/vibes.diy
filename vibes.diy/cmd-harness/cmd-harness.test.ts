import { describe, expect, it } from "vitest";
import { createCliStream, isCmdProgress, makeCmdTsEvento, OutputSelector, sendProgress } from "./index.js";

describe("cmd-harness re-exports", () => {
  it("re-exports the cmd-tools wire protocol + the harness symbols", () => {
    expect(typeof isCmdProgress).toBe("function");
    expect(typeof sendProgress).toBe("function");
    expect(typeof makeCmdTsEvento).toBe("function");
    expect(typeof OutputSelector).toBe("function");
    expect(isCmdProgress({ type: "core-cli.progress", level: "info", message: "hi" })).toBe(true);
    expect(isCmdProgress({ type: "not-progress" })).toBe(false);
  });
});

describe("createCliStream", () => {
  it("wraps an enqueued handler's result in a msg.cmd-ts envelope", async () => {
    const cli = createCliStream();
    // Read concurrently: the transform stream applies backpressure, so an
    // enqueued write only resolves once a reader pulls (exactly how the runCli
    // loop consumes it). Reading first, then closing, mirrors that.
    const reader = cli.stream.getReader();
    const handler = cli.enqueue((args) => ({ echoed: args }));
    // The cmd-ts handler signature isn't relevant to this unit; drive it directly.
    (handler as unknown as (a: unknown) => void)({ foo: "bar" });

    const { value } = await reader.read();
    expect(value).toMatchObject({
      type: "msg.cmd-ts",
      cmdTs: { outputFormat: "text" },
      result: { echoed: { foo: "bar" } },
    });
    reader.releaseLock();
    await cli.close();
  });
});
