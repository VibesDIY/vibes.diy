import { beforeAll, describe, expect, it } from "vitest";
import { processStream, MockLogger } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { type } from "arktype";
import type { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { isSectionEvent } from "@vibes.diy/api-types";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";

function allTexts(messages: readonly ChatMessage[]): string[] {
  return messages.flatMap((m) => m.content.map((c) => (c.type === "text" ? c.text : "")));
}

const HANDLER_SEQ_BASE = 1_667_160;
const PRIMARY_MODEL = "anthropic/claude-opus-4.7";
const FALLBACK_MODEL = "google/gemini-3.1-pro-preview";
const encoder = new TextEncoder();

async function collectBlocks(chat: {
  sectionStream: ReadableStream<unknown>;
  close: () => Promise<void>;
}): Promise<PromptAndBlockMsgs[]> {
  const blocks: PromptAndBlockMsgs[] = [];
  await processStream(chat.sectionStream, async (msg) => {
    if (isSectionEvent(msg)) {
      blocks.push(...msg.blocks);
      if (msg.blocks.some((b) => b.type === "prompt.block-end")) {
        await chat.close();
      }
    }
  });
  return blocks;
}

async function collectBlocksUntil(
  chat: {
    sectionStream: ReadableStream<unknown>;
    close: () => Promise<void>;
  },
  shouldStop: (blocks: readonly PromptAndBlockMsgs[]) => boolean
): Promise<PromptAndBlockMsgs[]> {
  const blocks: PromptAndBlockMsgs[] = [];
  await processStream(chat.sectionStream, async (msg) => {
    if (isSectionEvent(msg)) {
      blocks.push(...msg.blocks);
      if (shouldStop(blocks)) {
        await chat.close();
      }
    }
  });
  return blocks;
}

function trackedFailureResponse(tag: string, init: ResponseInit, onDrain: (tag: string) => void): Response {
  let sent = false;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent === false) {
          sent = true;
          onDrain(tag);
          controller.enqueue(encoder.encode(tag));
          controller.close();
        }
      },
    }),
    init
  );
}

describe("promptChatSection handler with selected+slots", () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: HANDLER_SEQ_BASE });
  });

  it("dryRun with selected:{kind:draft,files} renders SELECTED_DRAFT as canonical", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const payload = await ctx.dryRun({
      chatId: chat.chatId,
      promptText: "make it pink",
      selected: {
        kind: "draft",
        files: [
          {
            type: "code-block",
            filename: "/App.jsx",
            lang: "jsx",
            content: "on-disk content",
          },
        ],
      },
    });

    const texts = allTexts(payload.messages);
    expect(texts.some((t) => t.includes("SELECTED_DRAFT"))).toBe(true);
    expect(texts.some((t) => t.includes("on-disk content"))).toBe(true);

    await chat.close();
  });

  it("dryRun without selected does not render SELECTED_DRAFT", async () => {
    const { appSlug, ownerHandle } = await ctx.createApp();
    const rOpen = await ctx.api.openChat({ ownerHandle, appSlug, mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const payload = await ctx.dryRun({
      chatId: chat.chatId,
      promptText: "make it blue",
    });

    const texts = allTexts(payload.messages);
    expect(texts.some((t) => t.includes("SELECTED_DRAFT"))).toBe(false);

    await chat.close();
  });

  it("retries a transient primary failure once, then uses the catalog fallback model", async () => {
    const calls: string[] = [];
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 100,
      apiUrlPort: 8788,
      llmRequest: async (prompt) => {
        const requestedModel = prompt.model;
        expect(requestedModel).toBeTypeOf("string");
        if (typeof requestedModel === "string") calls.push(requestedModel);
        if (calls.length < 3) return new Response("unavailable", { status: 503, statusText: "Service Unavailable" });
        return new Response("", { status: 200 });
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await collectBlocks(chat);

    expect(calls).toEqual([PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL]);
    expect(blocks.some((b) => b.type === "prompt.error")).toBe(false);
    expect(blocks.find((b) => b.type === "prompt.req")).toEqual(
      expect.objectContaining({
        request: expect.objectContaining({ model: PRIMARY_MODEL }),
      })
    );
  });

  it("drains failed response bodies before retrying", async () => {
    const drained: string[] = [];
    const calls: string[] = [];
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 400,
      apiUrlPort: 8791,
      llmRequest: async (prompt) => {
        const requestedModel = prompt.model;
        expect(requestedModel).toBeTypeOf("string");
        if (typeof requestedModel === "string") calls.push(requestedModel);
        if (calls.length === 2) expect(drained).toEqual(["primary"]);
        if (calls.length === 3) expect(drained).toEqual(["primary", "primary-retry"]);
        if (calls.length === 1) {
          return trackedFailureResponse("primary", { status: 503, statusText: "Service Unavailable" }, (tag) => {
            drained.push(tag);
          });
        }
        if (calls.length === 2) {
          return trackedFailureResponse("primary-retry", { status: 502, statusText: "Bad Gateway" }, (tag) => {
            drained.push(tag);
          });
        }
        return new Response("", { status: 200 });
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await collectBlocks(chat);

    expect(calls).toEqual([PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL]);
    expect(drained).toEqual(["primary", "primary-retry"]);
    expect(blocks.some((b) => b.type === "prompt.error")).toBe(false);
  });

  it("does not retry non-transient upstream failures", async () => {
    const calls: string[] = [];
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 200,
      apiUrlPort: 8789,
      llmRequest: async (prompt) => {
        const requestedModel = prompt.model;
        expect(requestedModel).toBeTypeOf("string");
        if (typeof requestedModel === "string") calls.push(requestedModel);
        return new Response("bad request", { status: 400, statusText: "Bad Request" });
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await collectBlocks(chat);

    expect(calls).toEqual([PRIMARY_MODEL]);
    expect(blocks.find((b) => b.type === "prompt.error")).toEqual(
      expect.objectContaining({
        error: expect.stringContaining(`primary ${PRIMARY_MODEL} failed with status 400 Bad Request`),
      })
    );
  });

  it("does not retry thrown upstream exceptions", async () => {
    const calls: string[] = [];
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 500,
      apiUrlPort: 8792,
      llmRequest: async (prompt) => {
        const requestedModel = prompt.model;
        expect(requestedModel).toBeTypeOf("string");
        if (typeof requestedModel === "string") calls.push(requestedModel);
        throw new Error("socket reset");
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await collectBlocks(chat);

    expect(calls).toEqual([PRIMARY_MODEL]);
    expect(blocks.find((b) => b.type === "prompt.error")).toEqual(
      expect.objectContaining({
        error: expect.stringContaining(`primary ${PRIMARY_MODEL} failed with error`),
      })
    );
  });

  it("reports all transient attempts when primary retry and fallback fail", async () => {
    const statuses = [
      { status: 503, statusText: "Service Unavailable" },
      { status: 502, statusText: "Bad Gateway" },
      { status: 504, statusText: "Gateway Timeout" },
    ];
    const calls: string[] = [];
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 300,
      apiUrlPort: 8790,
      llmRequest: async (prompt) => {
        const requestedModel = prompt.model;
        expect(requestedModel).toBeTypeOf("string");
        if (typeof requestedModel === "string") calls.push(requestedModel);
        const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
        return new Response("transient", status);
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await collectBlocks(chat);
    const errorBlock = blocks.find((b) => b.type === "prompt.error");

    expect(calls).toEqual([PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL]);
    expect(errorBlock).toEqual(
      expect.objectContaining({
        error: expect.stringContaining(`fallback ${FALLBACK_MODEL} failed with status 504 Gateway Timeout`),
      })
    );
    expect(errorBlock).toEqual(
      expect.objectContaining({
        error: expect.stringContaining(`primary-retry ${PRIMARY_MODEL} failed with status 502 Bad Gateway`),
      })
    );
  });

  it("emits prompt.req before the upstream LLM response resolves", async () => {
    let resolveLlm: (res: Response) => void = (_res) => undefined;
    let resolveStarted: () => void = () => undefined;
    const llmStarted = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 600,
      apiUrlPort: 8793,
      llmRequest: async () => {
        resolveStarted();
        return new Promise<Response>((resolve) => {
          resolveLlm = resolve;
        });
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();
    let promptReqTimeout: ReturnType<typeof setTimeout> | null = null;

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await Promise.race([
      collectBlocksUntil(chat, (seen) => seen.some((b) => b.type === "prompt.req")),
      new Promise<PromptAndBlockMsgs[]>((resolve) => {
        promptReqTimeout = setTimeout(() => {
          void chat.close();
          resolve([]);
        }, 500);
      }),
    ]);
    if (promptReqTimeout !== null) clearTimeout(promptReqTimeout);

    expect(blocks.find((b) => b.type === "prompt.req")).toEqual(expect.objectContaining({ type: "prompt.req" }));
    await Promise.race([
      llmStarted,
      new Promise<void>((_resolve, reject) => {
        setTimeout(() => reject(new Error("llmRequest did not start")), 500);
      }),
    ]);
    resolveLlm(new Response("", { status: 200 }));
  });

  it("does not use catalog fallback for image-mode LLM requests", async () => {
    const calls: string[] = [];
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 700,
      apiUrlPort: 8794,
      llmRequest: async (prompt) => {
        const requestedModel = prompt.model;
        expect(requestedModel).toBeTypeOf("string");
        if (typeof requestedModel === "string") calls.push(requestedModel);
        return new Response("unavailable", { status: 503, statusText: "Service Unavailable" });
      },
    });
    const { appSlug, ownerHandle } = await local.createApp();
    const rOpen = await local.api.openChat({ ownerHandle, appSlug, mode: "img" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "draw a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await collectBlocks(chat);

    expect(calls).toEqual([PRIMARY_MODEL, PRIMARY_MODEL]);
    expect(blocks.find((b) => b.type === "prompt.error")).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Mode img does not support LLM fallback"),
      })
    );
  });

  it("honors Retry-After for retry delay", async () => {
    const starts: number[] = [];
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 800,
      apiUrlPort: 8795,
      llmRequest: async () => {
        starts.push(Date.now());
        if (starts.length === 1) {
          return new Response("rate limited", {
            status: 429,
            statusText: "Too Many Requests",
            headers: { "Retry-After": "2" },
          });
        }
        return new Response("", { status: 200 });
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blocks = await collectBlocks(chat);

    expect(starts.length).toBe(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1950);
    expect(starts[1] - starts[0]).toBeLessThan(2600);
    expect(blocks.some((b) => b.type === "prompt.error")).toBe(false);
  });

  it("logs structured edge diagnostics for a Cloudflare 1019 backend failure", async () => {
    const { logger, logCollector } = MockLogger();
    const sthis = ensureSuperThis({ logger });
    const calls: string[] = [];
    const body = JSON.stringify({
      error: {
        code: 503,
        message: "Provider returned error",
        metadata: { provider_name: "anthropic", raw: "error code: 1019" },
      },
      openrouter_metadata: {
        requested: PRIMARY_MODEL,
        strategy: "fallback",
        region: "us-east",
        summary: "all providers unavailable",
        attempt: 1,
        is_byok: false,
      },
    });
    const local = await createApiTestCtx({
      seqUserIdBase: HANDLER_SEQ_BASE + 900,
      apiUrlPort: 8796,
      sthis,
      llmRequest: async (prompt) => {
        if (typeof prompt.model === "string") calls.push(prompt.model);
        return new Response(body, {
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            "cf-ray": "9a1f0c2b3abc1234-ATL",
            server: "cloudflare",
            "content-type": "application/json",
            "x-generation-id": "gen-abc123",
          },
        });
      },
    });
    const rOpen = await local.api.openChat({ mode: "chat" });
    expect(rOpen.isOk()).toBe(true);
    const chat = rOpen.Ok();

    const rPrompt = await chat.prompt({
      model: PRIMARY_MODEL,
      messages: [{ role: "user", content: [{ type: "text", text: "build a todo app" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    await collectBlocks(chat);

    await sthis.logger.Flush();
    const logRow = type({ level: "string", msg: "string", event: { "[string]": "unknown" } });
    const logs = logCollector.Logs().flatMap((entry) => {
      const row = logRow(entry);
      return row instanceof type.errors ? [] : [row];
    });
    const attemptLogs = logs.filter((l) => l.msg === "llm-request-attempt-failed");

    expect(calls).toEqual([PRIMARY_MODEL, PRIMARY_MODEL, FALLBACK_MODEL]);
    expect(attemptLogs.map((l) => l.event.label)).toEqual(["primary", "primary-retry", "fallback"]);

    const primary = attemptLogs[0];
    expect(primary.level).toBe("warn");
    expect(primary.event).toEqual(
      expect.objectContaining({
        phase: "initial",
        mode: "chat",
        model: PRIMARY_MODEL,
        status: 503,
        statusText: "Service Unavailable",
        retryable: true,
        providerName: "anthropic",
        edgeErrorCode: "1019",
        edgeErrorVendor: "cloudflare",
        edgeErrorFamily: "cloudflare-1xxx",
      })
    );
    expect(typeof primary.event.elapsedMs).toBe("number");
    expect(primary.event.headers).toEqual(expect.objectContaining({ "cf-ray": "9a1f0c2b3abc1234-ATL", server: "cloudflare" }));
    expect(primary.event.openrouterMeta).toEqual(
      expect.objectContaining({
        requested: PRIMARY_MODEL,
        strategy: "fallback",
        region: "us-east",
        attempt: 1,
        is_byok: false,
      })
    );

    expect(attemptLogs[2].event.model).toBe(FALLBACK_MODEL);
    expect(attemptLogs[2].event.edgeErrorCode).toBe("1019");

    // Sanitization: our diagnostics never carry prompt text or secret-looking values.
    const serialized = JSON.stringify(attemptLogs);
    expect(serialized).not.toContain("build a todo app");
    expect(serialized).not.toContain("llm-api-key");
  });
});
