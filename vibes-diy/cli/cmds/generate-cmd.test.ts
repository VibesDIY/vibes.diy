import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqGenerate, generateCmd, isReqGenerate } from "./generate-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

describe("generateCmd", () => {
  it("omitted --model produces a request that passes isReqGenerate (no model: undefined leak)", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(generateCmd(ctx), ["Make a todo app", "--api-url", "https://example.com/api"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqGenerate }).result;
    expect(isReqGenerate(request)).toBe(true);
    expect("model" in request).toBe(false);
  });

  it("--model flag is parsed and forwarded as model in the request", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(generateCmd(ctx), [
      "Make a todo app",
      "--model",
      "qwen/qwen3-coder-480b-a35b-instruct",
      "--api-url",
      "https://example.com/api",
    ]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqGenerate }).result;
    expect(isReqGenerate(request)).toBe(true);
    expect(request).toMatchObject({ model: "qwen/qwen3-coder-480b-a35b-instruct" });
  });
});
