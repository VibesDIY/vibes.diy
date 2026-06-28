import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqAppChats, appChatsCmd, isReqAppChats } from "./app-chats-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

async function runAppChats(args: string[]): Promise<ReqAppChats> {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(appChatsCmd(ctx), args);
  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  const request = (first.value as { result: ReqAppChats }).result;
  expect(isReqAppChats(request)).toBe(true);
  return request;
}

describe("appChatsCmd", () => {
  it("bare positional vibe issues a list-application-chats request (not codegen)", async () => {
    const request = await runAppChats(["my-app", "--api-url", "https://example.com/api"]);
    // Must be the APPLICATION chats type — NOT the codegen type
    expect(request.type).toBe("vibes-diy.cli.app-chats");
    expect(request.type).not.toBe("vibes-diy.cli.codegen-log");
    expect(request.type).not.toBe("vibes-diy.cli.chats");
    expect(request.appSlug).toBe("my-app");
    expect(request.ownerHandle).toBe("");
    expect(request.chatId).toBeUndefined();
  });

  it("splits handle/app-slug positional into separate fields", async () => {
    const request = await runAppChats(["jchris/hat-smeller"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
  });

  it("positional vibe + chatId issues a get-application-chat request", async () => {
    const request = await runAppChats(["jchris/hat-smeller", "chat-123"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
    expect(request.chatId).toBe("chat-123");
    // Deep-read path — type stays the same, chatId being set is what triggers deep-read
    expect(request.type).toBe("vibes-diy.cli.app-chats");
  });

  it("--vibe works without a positional arg", async () => {
    const request = await runAppChats(["--vibe", "alice/cool-app"]);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
    expect(request.chatId).toBeUndefined();
  });

  it("--vibe shifts the lone positional to chatId", async () => {
    const request = await runAppChats(["chat-123", "--vibe", "alice/cool-app"]);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
    expect(request.chatId).toBe("chat-123");
  });

  it("explicit --handle overrides handle parsed from positional", async () => {
    const request = await runAppChats(["jchris/hat-smeller", "--handle", "other-user"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("other-user");
  });

  it("appSlug-only (no chatId) keeps chatId undefined regardless of flags", async () => {
    const request = await runAppChats(["jchris/hat-smeller"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.chatId).toBeUndefined();
    // No response-family flags — this is a simple LIST command
  });

  it("rejects the legacy placeholder form (vibe positional + chatId + --vibe)", async () => {
    const ctx = makeCtx();
    await expect(run(appChatsCmd(ctx), ["ignored", "chat-123", "--vibe", "alice/cool-app"])).rejects.toThrow(
      "--vibe already supplies the vibe — drop the extra leading positional (the placeholder vibe argument is no longer needed)."
    );
    await ctx.cliStream.close();
  });

  it("request type is vibes-diy.cli.app-chats (distinct from codegen-log and chats)", async () => {
    const request = await runAppChats(["my-app"]);
    expect(request.type).toBe("vibes-diy.cli.app-chats");
    // Explicitly assert it is NOT the sibling command types
    expect(request.type).not.toBe("vibes-diy.cli.codegen-log");
    expect(request.type).not.toBe("vibes-diy.cli.chats");
  });
});
