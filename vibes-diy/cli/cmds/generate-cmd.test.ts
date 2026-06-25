import { AppContext, Result } from "@adviser/cement";
import type { SectionEvent } from "@vibes.diy/api-types";
import { run } from "cmd-ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqGenerate, generateCmd, generateEvento, isReqGenerate } from "./generate-cmd.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

// A section stream carrying a single prompt.dry-run-payload block, framed the
// same way the server emits one on a dryRun:true request.
function dryRunPayloadStream(opts: {
  chatId: string;
  streamId: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: { type: "text"; text: string }[] }[];
}): ReadableStream<SectionEvent> {
  return new ReadableStream<SectionEvent>({
    start(controller) {
      controller.enqueue({
        type: "vibes.diy.section-event",
        chatId: opts.chatId,
        promptId: opts.streamId,
        blockSeq: 0,
        timestamp: new Date(),
        blocks: [
          {
            type: "prompt.dry-run-payload",
            streamId: opts.streamId,
            chatId: opts.chatId,
            seq: 0,
            timestamp: new Date(),
            request: { model: opts.model, messages: opts.messages },
          },
        ] as unknown as SectionEvent["blocks"],
      });
      controller.close();
    },
  });
}

function buildTrigger(args: ReqGenerate, api: unknown, sent: unknown[]) {
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
  } as unknown as Parameters<typeof generateEvento.handle>[0];
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

  it("--dry-run and --transcript flags map into the request (default false)", async () => {
    const ctx = makeCtx();
    const reader = ctx.cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(generateCmd(ctx), ["Make a todo app", "--api-url", "https://example.com/api"]);

    const first = await firstRead;
    await ctx.cliStream.close();
    const request = (first.value as { result: ReqGenerate }).result;
    expect(request).toMatchObject({ dryRun: false, transcript: false });
  });
});

describe("generateEvento dry-run", () => {
  function dryRunApi(stream: ReadableStream<SectionEvent>) {
    const calls = { openChat: [] as unknown[], prompt: [] as unknown[], ensureAppSlug: [] as unknown[] };
    const chat = {
      chatId: "chat-dry",
      appSlug: "todo-app",
      ownerHandle: "alice",
      sectionStream: stream,
      prompt: async (req: unknown, opts: unknown) => {
        calls.prompt.push({ req, opts });
        return Result.Ok({ promptId: "stream-dry" });
      },
      close: async () => undefined,
    };
    const api = {
      openChat: async (req: unknown) => {
        calls.openChat.push(req);
        return Result.Ok(chat);
      },
      // If the handler ever reaches the push path, this records it so the test
      // can assert it was NOT called in dry-run mode.
      ensureAppSlug: async (req: unknown) => {
        calls.ensureAppSlug.push(req);
        return Result.Ok({ appSlug: "todo-app", ownerHandle: "alice", mode: "production", fsId: "fs", env: {}, fileSystem: [] });
      },
    };
    return { api, calls };
  }

  function baseArgs(over: Partial<ReqGenerate>): ReqGenerate {
    return {
      type: "vibes-diy.cli.generate",
      prompt: "a todo app",
      appSlug: "",
      ownerHandle: "alice",
      instantJoin: false,
      verbose: false,
      apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
      dryRun: true,
      transcript: false,
      ...over,
    };
  }

  it("prints {model, messages} JSON and creates no vibe / writes no files", async () => {
    const stream = dryRunPayloadStream({
      chatId: "chat-dry",
      streamId: "stream-dry",
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        { role: "system", content: [{ type: "text", text: "you are a vibe coder" }] },
        { role: "user", content: [{ type: "text", text: "a todo app" }] },
      ],
    });
    const { api, calls } = dryRunApi(stream);
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    const sent: unknown[] = [];
    const r = await generateEvento.handle(buildTrigger(baseArgs({}), api, sent));
    expect(r.isOk()).toBe(true);

    const out = JSON.parse(writes.join(""));
    expect(out.model).toBe("anthropic/claude-sonnet-4-6");
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0].role).toBe("system");

    // dryRun + dryRunPreAllocate are forwarded so the server previews the real
    // generate-path prompt (pre-allocation runs in-memory, persists nothing);
    // openChat omits the prompt so no pre-allocation metadata is persisted,
    // passes dryRun:true so it creates no chatContexts row / appSlugBinding
    // (#2364); and no push is attempted.
    const promptOpts = (calls.prompt[0] as { opts: { dryRun?: boolean; dryRunPreAllocate?: boolean } }).opts;
    expect(promptOpts.dryRun).toBe(true);
    expect(promptOpts.dryRunPreAllocate).toBe(true);
    expect(calls.openChat).toEqual([{ ownerHandle: "alice", appSlug: undefined, mode: "codegen", dryRun: true }]);
    expect(calls.ensureAppSlug).toEqual([]);

    const res = sent.find((m) => (m as { result?: { type?: string } }).result?.type === "vibes-diy.cli.res-generate") as {
      result: { url: string; directory: string };
    };
    expect(res.result.url).toBe("");
    expect(res.result.directory).toBe("");
  });

  it("--transcript renders a human-readable role-headed transcript", async () => {
    const stream = dryRunPayloadStream({
      chatId: "chat-dry",
      streamId: "stream-dry",
      model: "m",
      messages: [
        { role: "system", content: [{ type: "text", text: "sys" }] },
        { role: "user", content: [{ type: "text", text: "a todo app" }] },
      ],
    });
    const { api } = dryRunApi(stream);
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    const r = await generateEvento.handle(buildTrigger(baseArgs({ transcript: true }), api, []));
    expect(r.isOk()).toBe(true);
    const out = writes.join("");
    expect(out).toContain("# model: m");
    expect(out).toContain("=== SYSTEM ===");
    expect(out).toContain("=== USER ===");
    expect(out).toContain("a todo app");
  });
});
