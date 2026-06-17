import { describe, expect, it } from "vitest";
import { promptReducer, PromptState } from "~/vibes.diy/app/routes/chat/prompt-state.js";
import { LLMChatEntry } from "@vibes.diy/api-types";

function baseState(overrides: Partial<PromptState> = {}): PromptState {
  return {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: "my-app",
    blocks: [],
    searchParams: new URLSearchParams(),
    setSearchParams: (() => undefined) as never,
    agentSavedBlockIds: new Set<string>(),
    connection: "live",
    ...overrides,
  };
}

function blockEnd(streamId: string) {
  return { type: "prompt.block-end" as const, streamId, chatId: "c1", seq: 9, timestamp: new Date() };
}

describe("promptReducer reconnect actions", () => {
  it("streamDisconnected while running enters reconnecting", () => {
    const next = promptReducer(baseState({ running: true }), { type: "streamDisconnected" });
    expect(next.connection).toBe("reconnecting");
  });

  it("streamDisconnected while idle is a no-op", () => {
    const state = baseState();
    expect(promptReducer(state, { type: "streamDisconnected" })).toBe(state);
  });

  it("streamDisconnected after prompt ack but before block-begin enters reconnecting", () => {
    // The route sets inFlightStreamId as soon as chat.prompt() resolves, but
    // `running` only flips true on the first prompt.block-begin. A transport
    // drop in that window must still start the reconnect loop.
    const state = baseState({ running: false, inFlightStreamId: "p-1" });
    const next = promptReducer(state, { type: "streamDisconnected" });
    expect(next.connection).toBe("reconnecting");
  });

  it("streamDisconnected after giving up stays failed", () => {
    const state = baseState({ running: true, connection: "failed" });
    expect(promptReducer(state, { type: "streamDisconnected" })).toBe(state);
  });

  it("setInFlightStreamId records the active prompt's streamId", () => {
    const next = promptReducer(baseState(), { type: "setInFlightStreamId", streamId: "p-1" });
    expect(next.inFlightStreamId).toBe("p-1");
  });

  it("replayReset clears stream-derived state but keeps settings and inFlightStreamId", () => {
    const state = baseState({
      running: true,
      hasCode: true,
      blocks: [{ msgs: [] }],
      current: { msgs: [] },
      connection: "reconnecting",
      inFlightStreamId: "p-1",
      title: "kept-title",
    });
    const next = promptReducer(state, { type: "replayReset" });
    expect(next.blocks).toEqual([]);
    expect(next.current).toBeUndefined();
    expect(next.running).toBe(false);
    expect(next.hasCode).toBe(false);
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
    expect(next.title).toBe("kept-title");
  });

  it("block-end matching inFlightStreamId converges: running false, connection live, id cleared", () => {
    const state = baseState({ running: true, connection: "reconnecting", inFlightStreamId: "p-1" });
    const next = promptReducer(state, blockEnd("p-1"));
    expect(next.running).toBe(false);
    expect(next.connection).toBe("live");
    expect(next.inFlightStreamId).toBeUndefined();
  });

  it("historical block-end with a different streamId does not converge", () => {
    const state = baseState({ running: true, connection: "reconnecting", inFlightStreamId: "p-1" });
    const next = promptReducer(state, blockEnd("old-turn"));
    expect(next.running).toBe(false);
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
  });

  it("reconnectFailed enters failed and stops running", () => {
    const state = baseState({ running: true, connection: "reconnecting" });
    const next = promptReducer(state, { type: "reconnectFailed" });
    expect(next.connection).toBe("failed");
    expect(next.running).toBe(false);
  });

  it("clearChat resets connection to live and clears inFlightStreamId", () => {
    const state = baseState({ connection: "failed", inFlightStreamId: "p-1" });
    const next = promptReducer(state, { type: "clearChat", appSlug: "other" });
    expect(next.connection).toBe("live");
    expect(next.inFlightStreamId).toBeUndefined();
  });
});

function promptReq(streamId: string, text: string) {
  return {
    type: "prompt.req" as const,
    streamId,
    chatId: "c1",
    seq: 0,
    timestamp: new Date(),
    request: {
      messages: [{ role: "user" as const, content: [{ type: "text" as const, text }] }],
    },
  };
}

describe("promptReducer optimistic prompt", () => {
  it("setOptimisticPrompt records the submitted text", () => {
    const next = promptReducer(baseState(), { type: "setOptimisticPrompt", text: "make it blue" });
    expect(next.optimisticPrompt).toBe("make it blue");
  });

  it("setOptimisticPrompt with undefined clears the bubble (failed send)", () => {
    const state = baseState({ optimisticPrompt: "make it blue" });
    const next = promptReducer(state, { type: "setOptimisticPrompt", text: undefined });
    expect(next.optimisticPrompt).toBeUndefined();
  });

  it("prompt.req echo retires the optimistic bubble and appends the real req", () => {
    const block = { msgs: [] };
    const state = baseState({ optimisticPrompt: "make it blue", blocks: [block], current: block });
    const next = promptReducer(state, promptReq("p-1", "make it blue"));
    expect(next.optimisticPrompt).toBeUndefined();
    expect(next.current?.msgs).toHaveLength(1);
    expect(next.blocks[0].msgs).toHaveLength(1);
  });

  it("prompt.req before any block still clears the optimistic bubble", () => {
    const state = baseState({ optimisticPrompt: "make it blue" });
    const next = promptReducer(state, promptReq("p-1", "make it blue"));
    expect(next.optimisticPrompt).toBeUndefined();
  });

  it("clearChat clears the optimistic bubble", () => {
    const state = baseState({ optimisticPrompt: "make it blue" });
    const next = promptReducer(state, { type: "clearChat", appSlug: "other" });
    expect(next.optimisticPrompt).toBeUndefined();
  });
});
