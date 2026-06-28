import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { chatsCmd } from "./chats-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

describe("chatsCmd (retired stub)", () => {
  it("warns and exits non-zero with no args", async () => {
    const ctx = makeCtx();
    await expect(run(chatsCmd(ctx), [])).rejects.toThrow("'vibes-diy chats' has been split");
    await ctx.cliStream.close();
  });

  it("warns and exits non-zero with a vibe positional", async () => {
    const ctx = makeCtx();
    await expect(run(chatsCmd(ctx), ["jchris/hat-smeller"])).rejects.toThrow("'vibes-diy chats' has been split");
    await ctx.cliStream.close();
  });

  it("warns and exits non-zero with vibe + chatId positionals", async () => {
    const ctx = makeCtx();
    await expect(run(chatsCmd(ctx), ["jchris/hat-smeller", "chat-123"])).rejects.toThrow("'vibes-diy chats' has been split");
    await ctx.cliStream.close();
  });

  it("error message mentions both replacement commands", async () => {
    const ctx = makeCtx();
    await expect(run(chatsCmd(ctx), [])).rejects.toThrow("codegen-log");
    await ctx.cliStream.close();
  });

  it("error message mentions app-chats", async () => {
    const ctx = makeCtx();
    await expect(run(chatsCmd(ctx), [])).rejects.toThrow("app-chats");
    await ctx.cliStream.close();
  });
});
