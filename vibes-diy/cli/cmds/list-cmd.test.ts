import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqVibesList, listCmd, isReqVibesList } from "./list-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

describe("listCmd", () => {
  it("enqueues a request that passes isReqVibesList", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(listCmd(ctx), ["--api-url", "https://example.com/api"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqVibesList }).result;
    expect(isReqVibesList(request)).toBe(true);
    expect(request.apiUrl).toBe("https://example.com/api");
  });

  it("defaults to the vibes.diy api url when --api-url is omitted", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(listCmd(ctx), []);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqVibesList }).result;
    expect(isReqVibesList(request)).toBe(true);
    expect(request.apiUrl).toContain("vibes.diy");
  });
});
