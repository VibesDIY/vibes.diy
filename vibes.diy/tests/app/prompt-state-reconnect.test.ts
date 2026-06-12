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
