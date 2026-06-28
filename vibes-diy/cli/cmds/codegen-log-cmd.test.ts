import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqCodegenLog, codegenLogCmd, isReqCodegenLog } from "./codegen-log-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

async function runCodegenLog(args: string[]): Promise<ReqCodegenLog> {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(codegenLogCmd(ctx), args);
  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  const request = (first.value as { result: ReqCodegenLog }).result;
  expect(isReqCodegenLog(request)).toBe(true);
  return request;
}

describe("codegenLogCmd", () => {
  it("bare positional vibe lists codegen chats (no chatId)", async () => {
    const request = await runCodegenLog(["my-app", "--api-url", "https://example.com/api"]);
    expect(request.type).toBe("vibes-diy.cli.codegen-log");
    expect(request.appSlug).toBe("my-app");
    expect(request.ownerHandle).toBe("");
    expect(request.chatId).toBeUndefined();
  });

  it("splits handle/app-slug positional into separate fields", async () => {
    const request = await runCodegenLog(["jchris/hat-smeller"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
  });

  it("positional vibe + chatId shows a specific chat", async () => {
    const request = await runCodegenLog(["jchris/hat-smeller", "chat-123"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
    expect(request.chatId).toBe("chat-123");
  });

  it("--vibe works without a positional arg", async () => {
    const request = await runCodegenLog(["--vibe", "alice/cool-app"]);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
    expect(request.chatId).toBeUndefined();
  });

  it("--vibe shifts the lone positional to chatId", async () => {
    const request = await runCodegenLog(["chat-123", "--vibe", "alice/cool-app"]);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
    expect(request.chatId).toBe("chat-123");
  });

  it("explicit --handle overrides handle parsed from positional", async () => {
    const request = await runCodegenLog(["jchris/hat-smeller", "--handle", "other-user"]);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("other-user");
  });

  it("--response sets the response flag for a specific chat", async () => {
    const request = await runCodegenLog(["jchris/hat-smeller", "chat-123", "--response"]);
    expect(request.chatId).toBe("chat-123");
    expect(request.response).toBe(true);
    expect(request.files).toBeFalsy();
    expect(request.jsonl).toBeFalsy();
  });

  it("--files and --jsonl flags flow through", async () => {
    const filesReq = await runCodegenLog(["jchris/hat-smeller", "chat-123", "--response", "--files"]);
    expect(filesReq.files).toBe(true);
    const jsonlReq = await runCodegenLog(["jchris/hat-smeller", "chat-123", "--response", "--jsonl"]);
    expect(jsonlReq.jsonl).toBe(true);
  });

  it("--turn maps to promptId; omitted leaves it undefined", async () => {
    const withTurn = await runCodegenLog(["jchris/hat-smeller", "chat-123", "--response", "--turn", "prompt-9"]);
    expect(withTurn.promptId).toBe("prompt-9");
    const withoutTurn = await runCodegenLog(["jchris/hat-smeller", "chat-123", "--response"]);
    expect(withoutTurn.promptId).toBeUndefined();
  });

  it("--user flag flows through", async () => {
    const request = await runCodegenLog(["jchris/hat-smeller", "chat-123", "--response", "--user"]);
    expect(request.user).toBe(true);
  });

  it("rejects the legacy placeholder form (vibe positional + chatId + --vibe)", async () => {
    const ctx = makeCtx();
    await expect(run(codegenLogCmd(ctx), ["ignored", "chat-123", "--vibe", "alice/cool-app"])).rejects.toThrow(
      "--vibe already supplies the vibe — drop the extra leading positional (the placeholder vibe argument is no longer needed)."
    );
    await ctx.cliStream.close();
  });

  it("request type is vibes-diy.cli.codegen-log (not the application chats type)", async () => {
    const request = await runCodegenLog(["my-app"]);
    // Must NOT be the application chats type
    expect(request.type).not.toBe("vibes-diy.cli.chats");
    expect(request.type).toBe("vibes-diy.cli.codegen-log");
  });
});
