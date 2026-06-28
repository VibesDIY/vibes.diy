import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqVersions, versionsCmd, isReqVersions } from "./versions-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

describe("versionsCmd", () => {
  it("enqueues a request that passes isReqVersions", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(versionsCmd(ctx), ["my-app", "--api-url", "https://example.com/api"]);
    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqVersions }).result;
    expect(isReqVersions(request)).toBe(true);
    expect(request.appSlug).toBe("my-app");
    expect(request.apiUrl).toBe("https://example.com/api");
  });

  it("splits handle/app-slug positional into separate fields", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(versionsCmd(ctx), ["jchris/hat-smeller"]);
    const first = await firstRead;
    await ctx.cliStream.close();
    const request = (first.value as { result: ReqVersions }).result;
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
  });

  it("--vibe overrides positional", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(versionsCmd(ctx), ["ignored", "--vibe", "alice/cool-app"]);
    const first = await firstRead;
    await ctx.cliStream.close();
    const request = (first.value as { result: ReqVersions }).result;
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
  });
});
