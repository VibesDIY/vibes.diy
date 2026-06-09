import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqPull, pullCmd, isReqPull, deriveHostnameBase } from "./pull-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

describe("pullCmd", () => {
  it("enqueues a request that passes isReqPull", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(pullCmd(ctx), ["my-app", "--api-url", "https://example.com/api"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqPull }).result;
    expect(isReqPull(request)).toBe(true);
    expect(request.appSlug).toBe("my-app");
    expect(request.apiUrl).toBe("https://example.com/api");
  });

  it("defaults to the vibes.diy api url when --api-url is omitted", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(pullCmd(ctx), ["my-app"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqPull }).result;
    expect(isReqPull(request)).toBe(true);
    expect(request.apiUrl).toContain("vibes.diy");
  });

  it("splits handle/app-slug positional into separate fields", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(pullCmd(ctx), ["jchris/hat-smeller"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqPull }).result;
    expect(isReqPull(request)).toBe(true);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
  });

  it("bare app-slug still works (handle resolved later)", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(pullCmd(ctx), ["hat-smeller"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    const request = (first.value as { result: ReqPull }).result;
    expect(isReqPull(request)).toBe(true);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("");
  });

  it("--vibe overrides positional", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(pullCmd(ctx), ["ignored-slug", "--vibe", "alice/cool-app"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    const request = (first.value as { result: ReqPull }).result;
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
  });

  it("--vibe works without a positional arg", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(pullCmd(ctx), ["--vibe", "alice/cool-app"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqPull }).result;
    expect(isReqPull(request)).toBe(true);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
  });

  it("explicit --handle overrides handle parsed from positional", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(pullCmd(ctx), ["jchris/hat-smeller", "--handle", "other-user"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    const request = (first.value as { result: ReqPull }).result;
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("other-user");
  });
});

describe("deriveHostnameBase", () => {
  it("maps vibes.diy to prod-v2", () => {
    expect(deriveHostnameBase("https://vibes.diy/api")).toBe("prod-v2.vibesdiy.net");
  });

  it("maps vibes.diy with cli stable-entry param to cli-v2", () => {
    expect(deriveHostnameBase("https://vibes.diy/api?.stable-entry.=cli")).toBe("cli-v2.vibesdiy.net");
  });

  it("strips subdomain from dev-v2 api url", () => {
    expect(deriveHostnameBase("https://vite.dev-v2.vibesdiy.net:8788")).toBe("dev-v2.vibesdiy.net");
  });

  it("handles localhost.vibesdiy.net with port", () => {
    expect(deriveHostnameBase("https://vite.localhost.vibesdiy.net:8888")).toBe("localhost.vibesdiy.net:8888");
  });
});
