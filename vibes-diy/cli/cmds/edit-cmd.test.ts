import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { AppContext, Result } from "@adviser/cement";
import type { SectionEvent } from "@vibes.diy/api-types";
import { run } from "cmd-ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqEdit, buildEditPromptRequest, editCmd, editEvento, isReqEdit } from "./edit-cmd.js";

const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

interface BlockBaseFields {
  readonly blockId: string;
  readonly seq: number;
  readonly blockNr: number;
  readonly streamId: string;
}

function blockBase(fields: BlockBaseFields) {
  return {
    blockId: fields.blockId,
    streamId: fields.streamId,
    seq: fields.seq,
    blockNr: fields.blockNr,
    timestamp: new Date(),
  };
}

interface CodeBlockFixture {
  readonly blockId: string;
  readonly blockNr: number;
  readonly sectionId: string;
  readonly path: string;
  readonly lines: readonly string[];
}

function codeBlockMessages(streamId: string, fx: CodeBlockFixture) {
  const lang = "jsx";
  const baseSeq = fx.blockNr * 100;
  const messages: unknown[] = [];
  messages.push({
    type: "block.code.begin",
    sectionId: fx.sectionId,
    lang,
    path: fx.path,
    ...blockBase({ blockId: fx.blockId, seq: baseSeq, blockNr: fx.blockNr, streamId }),
  });
  fx.lines.forEach((line, idx) => {
    messages.push({
      type: "block.code.line",
      sectionId: fx.sectionId,
      lang,
      path: fx.path,
      lineNr: idx + 1,
      line,
      ...blockBase({ blockId: fx.blockId, seq: baseSeq + 1 + idx, blockNr: fx.blockNr, streamId }),
    });
  });
  const afterLines = baseSeq + 1 + fx.lines.length;
  messages.push({
    type: "block.code.end",
    sectionId: fx.sectionId,
    lang,
    path: fx.path,
    stats: { lines: fx.lines.length, bytes: fx.lines.join("\n").length },
    ...blockBase({ blockId: fx.blockId, seq: afterLines, blockNr: fx.blockNr, streamId }),
  });
  messages.push({
    type: "block.end",
    stats: {
      toplevel: { lines: 0, bytes: 0 },
      code: { lines: fx.lines.length, bytes: fx.lines.join("\n").length },
      image: { lines: 0, bytes: 0 },
      total: { lines: fx.lines.length, bytes: fx.lines.join("\n").length },
    },
    usage: {
      given: [],
      calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    },
    ...blockBase({ blockId: fx.blockId, seq: afterLines + 1, blockNr: fx.blockNr, streamId }),
  });
  return messages;
}

function sectionEventStream(streamId: string, blockFixtures: readonly CodeBlockFixture[]): ReadableStream<SectionEvent> {
  return new ReadableStream<SectionEvent>({
    start(controller) {
      blockFixtures.forEach((fx, idx) => {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: streamId,
          blockSeq: idx,
          timestamp: new Date(),
          blocks: codeBlockMessages(streamId, fx) as SectionEvent["blocks"],
        });
      });
      controller.close();
    },
  });
}

function buildTrigger(args: ReqEdit, api: unknown, sent: unknown[]) {
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
    request: {
      type: "msg.cmd-ts",
      cmdTs: { raw: args, outputFormat: "text" },
      result: args,
    },
    validated: args,
    send: {
      send: async (_trigger: unknown, data: unknown) => {
        sent.push(data);
        return Result.Ok(undefined);
      },
    },
  } as unknown as Parameters<typeof editEvento.handle>[0];
}

function buildApi(opts: { sectionStream: ReadableStream<SectionEvent>; promptId: string; appSlug: string; ownerHandle: string }) {
  const calls = {
    openChat: [] as unknown[],
    prompt: [] as unknown[],
    ensureAppSlug: [] as unknown[],
    ensureAppSettings: [] as unknown[],
  };

  const chat = {
    appSlug: opts.appSlug,
    ownerHandle: opts.ownerHandle,
    sectionStream: opts.sectionStream,
    prompt: async (req: unknown) => {
      calls.prompt.push(req);
      return Result.Ok({ promptId: opts.promptId });
    },
    close: async () => undefined,
  };

  const api = {
    openChat: async (req: unknown) => {
      calls.openChat.push(req);
      return Result.Ok(chat);
    },
    ensureAppSlug: async (req: unknown) => {
      calls.ensureAppSlug.push(req);
      return Result.Ok({
        type: "vibes.diy.res-ensure-app-slug",
        appSlug: opts.appSlug,
        ownerHandle: opts.ownerHandle,
        mode: "production",
        fsId: "fs-1",
        env: {},
        fileSystem: [],
      });
    },
    ensureAppSettings: async (req: unknown) => {
      calls.ensureAppSettings.push(req);
      return Result.Ok({ settings: { entry: {} } });
    },
  };

  return { api, calls };
}

describe("editEvento", () => {
  it("maps CLI args into a vibes-diy.cli.edit request", async () => {
    const cliStream = cmd_tsStream();
    const ctx: CliCtx = {
      sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
      cliStream,
      output: { stdout: () => undefined, stderr: () => undefined },
      exitCode: 0,
    };

    const reader = cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(editCmd(ctx), [
      "todo-app",
      "Refine the UI",
      "--user-slug",
      "alice",
      "--dir",
      "/tmp/target",
      "--api-url",
      "https://example.com/api",
    ]);

    const first = await firstRead;
    await cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqEdit }).result;
    expect(request).toMatchObject({
      type: "vibes-diy.cli.edit",
      appSlug: "todo-app",
      prompt: "Refine the UI",
      ownerHandle: "alice",
      dir: "/tmp/target",
      apiUrl: "https://example.com/api",
      instantJoin: false,
      verbose: false,
      dryRun: false,
      transcript: false,
    });
  });

  it("omitted --model produces a request that passes isReqEdit (no model: undefined leak)", async () => {
    const cliStream = cmd_tsStream();
    const ctx: CliCtx = {
      sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
      cliStream,
      output: { stdout: () => undefined, stderr: () => undefined },
      exitCode: 0,
    };

    const reader = cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(editCmd(ctx), ["todo-app", "Refine the UI", "--api-url", "https://example.com/api"]);

    const first = await firstRead;
    await cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqEdit }).result;
    // ArkType `model?: "string"` rejects an explicit `undefined`; if the
    // handler spread `model: undefined` into the payload, isReqEdit would
    // return false and the evento dispatcher would silently drop the request.
    expect(isReqEdit(request)).toBe(true);
    expect("model" in request).toBe(false);
  });

  it("--model flag is parsed and forwarded as model in the request", async () => {
    const cliStream = cmd_tsStream();
    const ctx: CliCtx = {
      sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
      cliStream,
      output: { stdout: () => undefined, stderr: () => undefined },
      exitCode: 0,
    };

    const reader = cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(editCmd(ctx), [
      "todo-app",
      "Refine the UI",
      "--model",
      "qwen/qwen3-coder-480b-a35b-instruct",
      "--api-url",
      "https://example.com/api",
    ]);

    const first = await firstRead;
    await cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqEdit }).result;
    expect(isReqEdit(request)).toBe(true);
    expect(request).toMatchObject({ model: "qwen/qwen3-coder-480b-a35b-instruct" });
  });

  it("--focus flag is parsed and forwarded as focusPath in the request", async () => {
    const cliStream = cmd_tsStream();
    const ctx: CliCtx = {
      sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
      cliStream,
      output: { stdout: () => undefined, stderr: () => undefined },
      exitCode: 0,
    };

    const reader = cliStream.stream.getReader();
    const firstRead = reader.read();
    await run(editCmd(ctx), ["todo-app", "Refine the UI", "--focus", "Card.jsx", "--api-url", "https://example.com/api"]);

    const first = await firstRead;
    await cliStream.close();
    expect(first.done).toBe(false);
    const request = (first.value as { result: ReqEdit }).result;
    expect(request).toMatchObject({
      type: "vibes-diy.cli.edit",
      focusPath: "Card.jsx",
    });
  });

  it("uses cwd by default and applies SEARCH/REPLACE against local seed files", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "edit-cmd-cwd-"));
    tempDirs.push(cwd);
    await writeFile(
      join(cwd, "App.jsx"),
      ['import React from "react";', "", "export default function App() {", "  return <h1>Hello</h1>;", "}"].join("\n"),
      "utf-8"
    );
    vi.spyOn(process, "cwd").mockReturnValue(cwd);

    const promptId = "prompt-edit-seed";
    const { api, calls } = buildApi({
      promptId,
      appSlug: "todo-app",
      ownerHandle: "alice",
      sectionStream: sectionEventStream(promptId, [
        {
          blockId: "b1",
          blockNr: 1,
          sectionId: "s1",
          path: "App.jsx",
          lines: ["<<<<<<< SEARCH", "  return <h1>Hello</h1>;", "=======", "  return <h1>Hello, world</h1>;", ">>>>>>> REPLACE"],
        },
      ]),
    });

    const sent: unknown[] = [];
    const args: ReqEdit = {
      type: "vibes-diy.cli.edit",
      appSlug: "todo-app",
      prompt: "Update the greeting",
      ownerHandle: "alice",
      instantJoin: false,
      verbose: false,
      dryRun: false,
      transcript: false,
      dir: "",
      apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
    };

    const r = await editEvento.handle(buildTrigger(args, api, sent));
    expect(r.isOk()).toBe(true);

    const updated = await readFile(join(cwd, "App.jsx"), "utf-8");
    expect(updated).toContain("Hello, world");
    expect(calls.openChat).toEqual([{ ownerHandle: "alice", appSlug: "todo-app", mode: "chat" }]);
    expect(calls.prompt).toEqual([
      {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: "Update the greeting" }],
          },
        ],
      },
    ]);

    const pushed = calls.ensureAppSlug[0] as { fileSystem: { filename: string; content: string }[] };
    const pushedApp = pushed.fileSystem.find((f) => f.filename === "/App.jsx");
    expect(pushedApp?.content).toContain("Hello, world");

    const resEdit = sent.find((msg) => {
      const maybe = msg as { result?: { type?: string } };
      return maybe.result?.type === "vibes-diy.cli.res-edit";
    }) as { result: { directory: string } };
    expect(resEdit.result.directory).toBe(cwd);
  });

  it("uses --dir for write and push instead of cwd", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "edit-cmd-work-"));
    const target = await mkdtemp(join(tmpdir(), "edit-cmd-target-"));
    tempDirs.push(cwd, target);
    await writeFile(join(cwd, "App.jsx"), "export default function App() { return <h1>CWD</h1>; }", "utf-8");
    await writeFile(join(target, "App.jsx"), "export default function App() { return <h1>Target</h1>; }", "utf-8");
    vi.spyOn(process, "cwd").mockReturnValue(cwd);

    const promptId = "prompt-edit-dir";
    const { api, calls } = buildApi({
      promptId,
      appSlug: "todo-app",
      ownerHandle: "alice",
      sectionStream: sectionEventStream(promptId, [
        {
          blockId: "b1",
          blockNr: 1,
          sectionId: "s1",
          path: "App.jsx",
          lines: ["<<<<<<< SEARCH", "<h1>Target</h1>", "=======", "<h1>Target Updated</h1>", ">>>>>>> REPLACE"],
        },
      ]),
    });

    const sent: unknown[] = [];
    const args: ReqEdit = {
      type: "vibes-diy.cli.edit",
      appSlug: "todo-app",
      prompt: "Edit in target dir",
      ownerHandle: "alice",
      instantJoin: false,
      verbose: false,
      dryRun: false,
      transcript: false,
      dir: target,
      apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
    };

    const r = await editEvento.handle(buildTrigger(args, api, sent));
    expect(r.isOk()).toBe(true);

    const cwdApp = await readFile(join(cwd, "App.jsx"), "utf-8");
    const targetApp = await readFile(join(target, "App.jsx"), "utf-8");
    expect(cwdApp).toContain("CWD");
    expect(targetApp).toContain("Target Updated");

    const pushed = calls.ensureAppSlug[0] as { fileSystem: { filename: string; content: string }[] };
    const pushedApp = pushed.fileSystem.find((f) => f.filename === "/App.jsx");
    expect(pushedApp?.content).toContain("Target Updated");

    const resEdit = sent.find((msg) => {
      const maybe = msg as { result?: { type?: string } };
      return maybe.result?.type === "vibes-diy.cli.res-edit";
    }) as { result: { directory: string } };
    expect(resEdit.result.directory).toBe(target);
  });

  it("bails with a no-changes error when the edit turn ends without any successful snapshots", async () => {
    // Repro for the silent-no-op symptom: dev.3 fixed the streamId filter so
    // the resolver no longer errors out on the historical replay's
    // prompt.block-end, but if the new edit turn produces a `block.end` with
    // no code blocks, fs.turn.end carries the unchanged seed and the CLI would
    // otherwise re-push a byte-identical app. We want a clear error instead.
    const cwd = await mkdtemp(join(tmpdir(), "edit-cmd-noop-"));
    tempDirs.push(cwd);
    const original = ['import React from "react";', "", "export default function App() {", "  return <h1>Hello</h1>;", "}"].join(
      "\n"
    );
    await writeFile(join(cwd, "App.jsx"), original, "utf-8");
    vi.spyOn(process, "cwd").mockReturnValue(cwd);

    const promptId = "prompt-noop";
    const bareBlockEndStream = new ReadableStream<SectionEvent>({
      start(controller) {
        controller.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId,
          blockSeq: 0,
          timestamp: new Date(),
          blocks: [
            {
              type: "block.end",
              stats: {
                toplevel: { lines: 0, bytes: 0 },
                code: { lines: 0, bytes: 0 },
                image: { lines: 0, bytes: 0 },
                total: { lines: 0, bytes: 0 },
              },
              usage: {
                given: [],
                calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              },
              ...blockBase({ blockId: "b1", seq: 0, blockNr: 1, streamId: promptId }),
            },
          ] as SectionEvent["blocks"],
        });
        controller.close();
      },
    });

    const { api, calls } = buildApi({
      promptId,
      appSlug: "todo-app",
      ownerHandle: "alice",
      sectionStream: bareBlockEndStream,
    });

    const sent: unknown[] = [];
    const args: ReqEdit = {
      type: "vibes-diy.cli.edit",
      appSlug: "todo-app",
      prompt: "Add a tea button",
      ownerHandle: "alice",
      instantJoin: false,
      verbose: false,
      dryRun: false,
      transcript: false,
      dir: "",
      apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
    };

    const r = await editEvento.handle(buildTrigger(args, api, sent));
    expect(r.isErr()).toBe(true);
    expect(r.Err().message).toContain("Edit turn produced no file changes");

    // Disk content must be untouched and no push must have been attempted.
    const onDisk = await readFile(join(cwd, "App.jsx"), "utf-8");
    expect(onDisk).toBe(original);
    expect(calls.ensureAppSlug).toEqual([]);
  });
});

describe("buildEditPromptRequest", () => {
  it("includes selected.draft when .undo is absent and disk has source files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "edit-req-draft-"));
    tempDirs.push(dir);
    await writeFile(join(dir, "App.jsx"), "function App(){}", "utf-8");

    const req = await buildEditPromptRequest({
      chatId: "c1",
      appSlug: "x",
      ownerHandle: "u",
      prompt: "make it pink",
      dir,
      focus: undefined,
    });

    expect(req.selected).toEqual({ kind: "draft", files: expect.any(Array) });
    const files = (req.selected as { kind: "draft"; files: unknown[] }).files;
    expect(files.length).toBe(1);
  });

  it("omits selected when .undo matches disk content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "edit-req-undo-"));
    tempDirs.push(dir);
    await writeFile(join(dir, "App.jsx"), "function App(){}", "utf-8");
    await writeFile(join(dir, ".undo"), JSON.stringify([{ filename: "App.jsx", content: "function App(){}" }]), "utf-8");

    const req = await buildEditPromptRequest({
      chatId: "c1",
      appSlug: "x",
      ownerHandle: "u",
      prompt: "go",
      dir,
      focus: undefined,
    });

    expect(req.selected).toBeUndefined();
  });
});
