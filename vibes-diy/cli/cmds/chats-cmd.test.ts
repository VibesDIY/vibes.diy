import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqChats, chatsCmd, isReqChats } from "./chats-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

async function runChats(args: string[]): Promise<ReqChats> {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(chatsCmd(ctx), args);
  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  const request = (first.value as { result: ReqChats }).result;
  expect(isReqChats(request)).toBe(true);
  return request;
}

describe("chatsCmd", () => {
  it("bare positional vibe lists chats (no chatId)", async () => {
    const request = await runChats(["my-app", "--api-url", "https://example.com/api"]);
    expect(request.appSlug).toBe("my-app");
    expect(request.ownerHandle).toBe("");
    expect(request.chatId).toBeUndefined();
  });

  it("splits handle/app-slug positional into separate fields", async () => {
    const request = await runChats(["jchris/hat-smeller"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
  });

  it("positional vibe + chatId shows a specific chat", async () => {
    const request = await runChats(["jchris/hat-smeller", "chat-123"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
    expect(request.chatId).toBe("chat-123");
  });

  it("--vibe works without a positional arg", async () => {
    const request = await runChats(["--vibe", "alice/cool-app"]);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
    expect(request.chatId).toBeUndefined();
  });

  it("--vibe shifts the lone positional to chatId", async () => {
    const request = await runChats(["chat-123", "--vibe", "alice/cool-app"]);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
    expect(request.chatId).toBe("chat-123");
  });

  it("explicit --handle overrides handle parsed from positional", async () => {
    const request = await runChats(["jchris/hat-smeller", "--handle", "other-user"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("other-user");
  });

  it("rejects the legacy placeholder form (vibe positional + chatId + --vibe)", async () => {
    const ctx = makeCtx();
    await expect(run(chatsCmd(ctx), ["ignored", "chat-123", "--vibe", "alice/cool-app"])).rejects.toThrow(
      "--vibe already supplies the vibe — drop the extra leading positional (the placeholder vibe argument is no longer needed)."
    );
    await ctx.cliStream.close();
  });
});
