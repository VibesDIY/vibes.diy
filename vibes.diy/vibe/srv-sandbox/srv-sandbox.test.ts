import { describe, it, expect } from "vitest";
import { Result } from "@adviser/cement";
import type { ReqCallAI } from "@vibes.diy/vibe-types";
import type { LLMRequest } from "@vibes.diy/call-ai-v2";
import { collectStructuredResult, executeCallAI } from "./call-ai-flow.js";
import type { CallAIApi } from "./call-ai-flow.js";

function createStream(events: readonly unknown[]): ReadableStream<unknown> {
  return new ReadableStream<unknown>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(event);
      }
      controller.close();
    },
  });
}

function createBlockBase() {
  return {
    blockId: "block-1",
    streamId: "stream-1",
    seq: 2,
    blockNr: 1,
    timestamp: new Date(),
  };
}

function createSectionEvent(blocks: readonly unknown[]) {
  return {
    type: "vibes.diy.section-event",
    chatId: "chat-1",
    promptId: "prompt-1",
    blockSeq: 1,
    timestamp: new Date(),
    blocks,
  };
}

function createToplevelLine(line: string) {
  return {
    ...createBlockBase(),
    type: "block.toplevel.line",
    sectionId: "section-1",
    lineNr: 1,
    line,
  };
}

function makeReqCallAI(): ReqCallAI {
  return {
    tid: "tid-1",
    type: "vibe.req.callAI",
    userSlug: "user-1",
    appSlug: "app-1",
    prompt: "Describe a sandwich",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        layers: { type: "array", items: { type: "string" } },
      },
    },
  };
}

interface MockApiState {
  api: CallAIApi;
  lastPromptReq: LLMRequest | undefined;
}

function makeApi(options: {
  readonly openChatError?: string;
  readonly promptError?: string;
  readonly sectionEvents?: readonly unknown[];
}): MockApiState {
  const state: MockApiState = {
    lastPromptReq: undefined,
    api: {
      openChat: async () => {
        if (options.openChatError !== undefined) {
          return Result.Err(new Error(options.openChatError));
        }
        return Result.Ok({
          sectionStream: createStream(options.sectionEvents ?? []),
          prompt: async (req: LLMRequest) => {
            state.lastPromptReq = req;
            if (options.promptError !== undefined) {
              return Result.Err(new Error(options.promptError));
            }
            return Result.Ok({});
          },
        });
      },
    },
  };

  return state;
}

describe("collectStructuredResult", () => {
  it("collects structured output from toplevel lines", async () => {
    const jsonLine = '{"name":"club","layers":["bread","turkey"]}';
    const stream = createStream([
      createSectionEvent([createToplevelLine(jsonLine)]),
    ]);

    const res = await collectStructuredResult(stream);
    expect(res.result).toBe(jsonLine);
    expect(res.promptId).toBe("prompt-1");
  });

  it("rejects when stream has no section events", async () => {
    await expect(collectStructuredResult(createStream([]))).rejects.toThrow("No section events received");
  });
});

describe("executeCallAI", () => {
  it("returns error when openChat fails", async () => {
    const { api } = makeApi({ openChatError: "open chat failed" });
    const res = await executeCallAI(makeReqCallAI(), api);
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.message).toContain("open chat failed");
    }
  });

  it("returns error when prompt fails", async () => {
    const { api } = makeApi({ promptError: "prompt failed" });
    const res = await executeCallAI(makeReqCallAI(), api);
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.message).toContain("prompt failed");
    }
  });

  it("returns ok with structured text and sends json_object response_format", async () => {
    const jsonLine = '{"name":"club","layers":["bread"]}';
    const state = makeApi({
      sectionEvents: [createSectionEvent([createToplevelLine(jsonLine)])],
    });

    const res = await executeCallAI(makeReqCallAI(), state.api);
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.promptId).toBe("prompt-1");
      expect(res.result).toBe(jsonLine);
    }

    expect(state.lastPromptReq).toBeDefined();
    expect(state.lastPromptReq!.response_format).toEqual({ type: "json_object" });
    expect(state.lastPromptReq!.messages[0].role).toBe("system");
  });
});
