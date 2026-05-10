import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { AppContext, Result } from "@adviser/cement";
import type { SectionEvent } from "@vibes.diy/api-types";
import { run } from "cmd-ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqEdit, editCmd, editEvento } from "./edit-cmd.js";

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

function buildApi(opts: {
  sectionStream: ReadableStream<SectionEvent>;
  promptId: string;
  appSlug: string;
  userSlug: string;
}) {
  const calls = {
    openChat: [] as unknown[],
    prompt: [] as unknown[],
    ensureAppSlug: [] as unknown[],
    ensureAppSettings: [] as unknown[],
  };

  const chat = {
    appSlug: opts.appSlug,
    userSlug: opts.userSlug,
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
        userSlug: opts.userSlug,
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
  it("maps CLI args into a use-vibes.cli.edit request", async () => {
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
      type: "use-vibes.cli.edit",
      appSlug: "todo-app",
      prompt: "Refine the UI",
      userSlug: "alice",
      dir: "/tmp/target",
      apiUrl: "https://example.com/api",
      instantJoin: false,
      verbose: false,
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
      userSlug: "alice",
      sectionStream: sectionEventStream(promptId, [
        {
          blockId: "b1",
          blockNr: 1,
          sectionId: "s1",
          path: "App.jsx",
          lines: [
            "<<<<<<< SEARCH",
            "  return <h1>Hello</h1>;",
            "=======",
            "  return <h1>Hello, world</h1>;",
            ">>>>>>> REPLACE",
          ],
        },
      ]),
    });

    const sent: unknown[] = [];
    const args: ReqEdit = {
      type: "use-vibes.cli.edit",
      appSlug: "todo-app",
      prompt: "Update the greeting",
      userSlug: "alice",
      instantJoin: false,
      verbose: false,
      dir: "",
      apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
    };

    const r = await editEvento.handle(buildTrigger(args, api, sent));
    expect(r.isOk()).toBe(true);

    const updated = await readFile(join(cwd, "App.jsx"), "utf-8");
    expect(updated).toContain("Hello, world");
    expect(calls.openChat).toEqual([{ userSlug: "alice", appSlug: "todo-app", mode: "chat" }]);
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
      return maybe.result?.type === "use-vibes.cli.res-edit";
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
      userSlug: "alice",
      sectionStream: sectionEventStream(promptId, [
        {
          blockId: "b1",
          blockNr: 1,
          sectionId: "s1",
          path: "App.jsx",
          lines: [
            "<<<<<<< SEARCH",
            "<h1>Target</h1>",
            "=======",
            "<h1>Target Updated</h1>",
            ">>>>>>> REPLACE",
          ],
        },
      ]),
    });

    const sent: unknown[] = [];
    const args: ReqEdit = {
      type: "use-vibes.cli.edit",
      appSlug: "todo-app",
      prompt: "Edit in target dir",
      userSlug: "alice",
      instantJoin: false,
      verbose: false,
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
      return maybe.result?.type === "use-vibes.cli.res-edit";
    }) as { result: { directory: string } };
    expect(resEdit.result.directory).toBe(target);
  });
});
