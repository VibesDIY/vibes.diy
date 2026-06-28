import { AppContext, Result } from "@adviser/cement";
import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import type { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { ReqAppChats, appChatsCmd, appChatsEvento, isReqAppChats } from "./app-chats-cmd.js";

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

// ---------------------------------------------------------------------------
// Handler-level tests: drive appChatsEvento.handle with a stubbed api so we
// exercise the actual LIST/deep-read logic rather than just argument parsing.
// ---------------------------------------------------------------------------

function makeBase(seq: number) {
  return { blockId: "blk", streamId: "s", seq, blockNr: 0, timestamp: new Date(0) };
}

function toplevelLine(seq: number, line: string): PromptAndBlockMsgs {
  return { type: "block.toplevel.line", sectionId: "s", lineNr: seq, line, ...makeBase(seq) } as unknown as PromptAndBlockMsgs;
}

function imageBlock(seq: number, url: string): PromptAndBlockMsgs {
  return {
    type: "block.image",
    sectionId: "s",
    url,
    stats: { lines: 0, bytes: url.length },
    ...makeBase(seq),
  } as unknown as PromptAndBlockMsgs;
}

function cidImageBlock(seq: number, cid: string): PromptAndBlockMsgs {
  return {
    type: "block.image",
    sectionId: "s",
    cid,
    stats: { lines: 0, bytes: cid.length },
    ...makeBase(seq),
  } as unknown as PromptAndBlockMsgs;
}

function buildTrigger(args: ReqAppChats, api: unknown, sent: unknown[]) {
  const cliCtx: CliCtx = {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream: cmd_tsStream(),
    output: { stdout: () => undefined, stderr: () => undefined },
    vibesDiyApiFactory: () => api as CliCtx["vibesDiyApiFactory"] extends (...x: never[]) => infer R ? R : never,
    exitCode: 0,
  };
  const appCtx = new AppContext().set("cliCtx", cliCtx);
  return {
    id: "trigger-1",
    ctx: appCtx,
    enRequest: args,
    request: { type: "msg.cmd-ts", cmdTs: { raw: args, outputFormat: "text" }, result: args },
    validated: args,
    send: {
      send: async (_trigger: unknown, data: unknown) => {
        sent.push(data);
        return Result.Ok(undefined);
      },
    },
  } as unknown as Parameters<typeof appChatsEvento.handle>[0];
}

describe("appChatsEvento handler", () => {
  it("LIST path calls listApplicationChats on the api (not getApplicationChat)", async () => {
    const listCalls: unknown[] = [];
    const api = {
      ensureUserSettings: async () => Result.Ok({ settings: [] }),
      listApplicationChats: async (req: unknown) => {
        listCalls.push(req);
        return Result.Ok({ items: [], nextCursor: undefined });
      },
    };

    const args: ReqAppChats = {
      type: "vibes-diy.cli.app-chats",
      appSlug: "hat-smeller",
      ownerHandle: "alice",
      apiUrl: "https://vibes.diy/api",
    };

    const sent: unknown[] = [];
    const r = await appChatsEvento.handle(buildTrigger(args, api, sent));
    expect(r.isOk()).toBe(true);
    // listApplicationChats was called — handler targeted the APPLICATION endpoint
    expect(listCalls).toHaveLength(1);
    expect(listCalls[0]).toMatchObject({ appSlug: "hat-smeller" });
    // The result carries the list type
    const result = (sent[0] as { result: unknown }).result;
    expect(result).toMatchObject({ type: "vibes-diy.cli.res-app-chats-list", items: [] });
  });

  it("deep-read path renders toplevel text AND image placeholder from blocks", async () => {
    const blocks: PromptAndBlockMsgs[] = [
      toplevelLine(0, "Here is your image:"),
      imageBlock(1, "https://example.com/img.png"),
      cidImageBlock(2, "bafyreiXYZ"),
    ];

    const api = {
      ensureUserSettings: async () => Result.Ok({ settings: [] }),
      getApplicationChat: async (_req: unknown) => {
        return Result.Ok({
          type: "vibes.diy.res-get-application-chat",
          chatId: "chat-abc",
          ownerHandle: "alice",
          appSlug: "hat-smeller",
          blocks,
        });
      },
    };

    const args: ReqAppChats = {
      type: "vibes-diy.cli.app-chats",
      appSlug: "hat-smeller",
      ownerHandle: "alice",
      chatId: "chat-abc",
      apiUrl: "https://vibes.diy/api",
    };

    const sent: unknown[] = [];
    const r = await appChatsEvento.handle(buildTrigger(args, api, sent));
    expect(r.isOk()).toBe(true);

    const result = (sent[0] as { result: { output: string } }).result;
    // Prose line is rendered verbatim
    expect(result.output).toContain("Here is your image:");
    // URL-bearing image block renders as placeholder
    expect(result.output).toContain("[image: https://example.com/img.png]");
    // CID-bearing image block (server-side image-gen) also renders
    expect(result.output).toContain("[image: bafyreiXYZ]");
    // Result carries the detail type
    expect(result).toMatchObject({ type: "vibes-diy.cli.res-app-chats-detail", chatId: "chat-abc" });
  });
});
