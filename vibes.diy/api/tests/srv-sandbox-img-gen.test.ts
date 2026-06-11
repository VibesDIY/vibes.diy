import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { LLMChat, OnResponseTypes, VibesDiyApiIface, VibesDiyError } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

// Seam G3 contract for the host-side `vibeImgGen` handler:
// - request type is `vibe.req.imgGen` (not `imgVibes`)
// - response carries `files: ImgGenFile[]` (not `imageUrls: string[]`)
// - each file entry is `{uploadId, cid, mimeType, size}` shape.
// Inputs are fed via DI (chatApi.openChat) — no module mocking.

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

interface CapturedMsg {
  readonly data: unknown;
  readonly origin: string;
}

function fakeMessageEvent(data: unknown, origin: string, source: Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

function makeFakeChat(blocks: unknown[]): LLMChat {
  return {
    tid: "tid",
    chatId: "chat-1",
    ownerHandle: "alice",
    appSlug: "demo",
    sectionStream: new ReadableStream<OnResponseTypes>({
      start(c) {
        c.enqueue({
          type: "vibes.diy.section-event",
          chatId: "chat-1",
          promptId: "prompt-1",
          blockSeq: 0,
          blocks,
          timestamp: new Date(),
        } as OnResponseTypes);
        c.close();
      },
    }),
    prompt: async () => Result.Ok({} as never),
    promptFS: async () => Result.Ok({} as never),
    close: async () => {
      /* noop */
    },
  } as unknown as LLMChat;
}

function setupSandbox(chat: Result<LLMChat, VibesDiyError>) {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const fakeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    openChat: async () => chat,
  };

  // imgGen is vibe-scoped and rides vibeApi (AppSessions), not chatApi (#2306).
  const noopChatApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
  };
  const sandbox = new vibesDiySrvSandbox({
    chatApi: noopChatApi as VibesDiyApiIface,
    vibeApi: fakeApi as VibesDiyApiIface,
    errorLogger: () => {
      /* noop */
    },
    eventListeners: {
      addEventListener: () => {
        /* noop */
      },
      removeEventListener: () => {
        /* noop */
      },
    },
  });
  return { sandbox, captured, iframe };
}

describe("vibeImgGen host handler (Seam G3)", () => {
  it("returns ok with files[] from block.image events carrying file refs", async () => {
    const blocks = [
      {
        type: "block.image",
        sectionId: "sec-1",
        blockId: "blk-1",
        streamId: "prompt-1",
        seq: 0,
        blockNr: 0,
        timestamp: new Date(),
        stats: { lines: 0, bytes: 100, cnt: 1 },
        uploadId: "upl-1",
        cid: "cid-1",
        mimeType: "image/png",
        size: 100,
      },
      {
        type: "prompt.block-end",
        streamId: "prompt-1",
        chatId: "chat-1",
        seq: 1,
        timestamp: new Date(),
      },
    ];
    const { sandbox, captured, iframe } = setupSandbox(Result.Ok(makeFakeChat(blocks)));

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibe.req.imgGen",
          tid: "tid-1",
          ownerHandle: "alice",
          appSlug: "demo",
          prompt: "a sunset",
        },
        "https://demo--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 60));

    const finalMsg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.imgGen");
    expect(finalMsg?.data).toMatchObject({
      tid: "tid-1",
      type: "vibe.res.imgGen",
      status: "ok",
      files: [{ uploadId: "upl-1", cid: "cid-1", mimeType: "image/png", size: 100 }],
    });
  });

  it("returns error when openChat fails", async () => {
    const { sandbox, captured, iframe } = setupSandbox(
      Result.Err({
        type: "vibes.diy.res-error",
        name: "VibesDiyError",
        message: "open chat failed",
      } as VibesDiyError)
    );

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibe.req.imgGen",
          tid: "tid-2",
          ownerHandle: "alice",
          appSlug: "demo",
          prompt: "a sunset",
        },
        "https://demo--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 30));

    const finalMsg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.imgGen");
    expect(finalMsg?.data).toMatchObject({ tid: "tid-2", status: "error" });
    expect((finalMsg?.data as { message: string }).message).toContain("open chat failed");
  });
});
