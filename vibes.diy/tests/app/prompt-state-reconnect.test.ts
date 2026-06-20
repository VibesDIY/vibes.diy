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

// A full BlockStreamMsg `block.end` (call-ai-v2 `isBlockEnd` demands BlockBase +
// stats + usage, plus a normalizable fsRef). This is the persisted, replayed
// terminal that carries fsRef — after the split it owns connection convergence.
function fsBlockEnd(streamId: string, fsId?: string) {
  return {
    type: "block.end" as const,
    blockId: `b-${streamId}`,
    streamId,
    seq: 1,
    blockNr: 1,
    timestamp: new Date(),
    stats: {
      toplevel: { lines: 0, bytes: 0 },
      code: { lines: 0, bytes: 0 },
      image: { lines: 0, bytes: 0 },
      total: { lines: 0, bytes: 0 },
    },
    usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    ...(fsId ? { fsRef: { appSlug: "app", ownerHandle: "owner", mode: "dev" as const, fsId } } : {}),
  };
}

function promptError(streamId: string, error = "boom") {
  return { type: "prompt.error" as const, streamId, chatId: "c1", seq: 9, timestamp: new Date(), error };
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

  // The split (VibesDIY/vibes.diy#2472): prompt.block-end is emitted early (when
  // generation ends, before the persist), so it flips `running` off ONLY. It must
  // NOT settle connection/inFlightStreamId — otherwise a disconnect in the gap
  // before the canonical block.end would orphan the convergence.
  it("prompt.block-end flips running off but no longer settles connection/inFlightStreamId", () => {
    const state = baseState({ running: true, connection: "reconnecting", inFlightStreamId: "p-1" });
    const next = promptReducer(state, blockEnd("p-1"));
    expect(next.running).toBe(false);
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
  });

  // The canonical post-persist block.end (BlockStreamMsg, carries fsRef) now owns
  // convergence — and is the one event replayed on reconnect-after-completion.
  it("block.end (BlockStreamMsg) matching inFlightStreamId with fsRef converges and appends", () => {
    const block = { msgs: [] };
    const state = baseState({
      running: false,
      connection: "reconnecting",
      inFlightStreamId: "p-1",
      blocks: [block],
      current: block,
    });
    const next = promptReducer(state, fsBlockEnd("p-1", "FS1"));
    expect(next.connection).toBe("live");
    expect(next.inFlightStreamId).toBeUndefined();
    // still appended for the fsRef consumers (nav / repoint / snapshots)
    expect(next.blocks[0].msgs).toHaveLength(1);
  });

  it("historical block.end with a different streamId appends but does not converge", () => {
    const block = { msgs: [] };
    const state = baseState({
      running: false,
      connection: "reconnecting",
      inFlightStreamId: "p-1",
      blocks: [block],
      current: block,
    });
    const next = promptReducer(state, fsBlockEnd("old-turn", "FS1"));
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
    expect(next.blocks[0].msgs).toHaveLength(1);
  });

  // Reconnect-gap (spec invariant 9): a disconnect after the early prompt.block-end
  // but before the canonical block.end leaves inFlightStreamId set, so the
  // reconnect loop can still re-open; a block.end with no fsRef (e.g. a synthetic
  // exhausted-recovery end) must not prematurely converge.
  it("block.end without fsRef appends but does not converge", () => {
    const block = { msgs: [] };
    const state = baseState({
      running: false,
      connection: "reconnecting",
      inFlightStreamId: "p-1",
      blocks: [block],
      current: block,
    });
    const next = promptReducer(state, fsBlockEnd("p-1"));
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
    expect(next.blocks[0].msgs).toHaveLength(1);
  });

  it("prompt.error is terminal: running false and the error block is appended (#2057)", () => {
    // A generation that writes block-begin then errors leaves the client
    // running:true until a terminal event arrives. The persisted prompt.error,
    // replayed on every reconnect, must flip running off and render so the
    // input re-enables instead of staying stuck in "Writing code...".
    const block = { msgs: [] };
    const state = baseState({ running: true, blocks: [block], current: block });
    const next = promptReducer(state, promptError("p-1"));
    expect(next.running).toBe(false);
    expect(next.current?.msgs).toHaveLength(1);
    expect(next.blocks[0].msgs).toHaveLength(1);
  });

  it("prompt.error matching inFlightStreamId converges to live and clears the id", () => {
    const state = baseState({ running: true, connection: "reconnecting", inFlightStreamId: "p-1" });
    const next = promptReducer(state, promptError("p-1"));
    expect(next.running).toBe(false);
    expect(next.connection).toBe("live");
    expect(next.inFlightStreamId).toBeUndefined();
  });

  it("historical prompt.error with a different streamId stops running but does not converge", () => {
    const state = baseState({ running: true, connection: "reconnecting", inFlightStreamId: "p-1" });
    const next = promptReducer(state, promptError("old-turn"));
    expect(next.running).toBe(false);
    expect(next.connection).toBe("reconnecting");
    expect(next.inFlightStreamId).toBe("p-1");
  });

  it("prompt.error with no current block still stops running", () => {
    const state = baseState({ running: true });
    const next = promptReducer(state, promptError("p-1"));
    expect(next.running).toBe(false);
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

  it("reconnect replay: a historical prompt.req does NOT clear the in-flight optimistic bubble", () => {
    // replayReset preserves optimisticPrompt + inFlightStreamId, then the reopened
    // stream replays older turns first. Those non-matching echoes must not remove
    // the just-submitted bubble before its own (p-2) echo replays.
    const block = { msgs: [] };
    const state = baseState({
      optimisticPrompt: "make it blue",
      inFlightStreamId: "p-2",
      blocks: [block],
      current: block,
    });
    const next = promptReducer(state, promptReq("p-1", "an earlier prompt"));
    expect(next.optimisticPrompt).toBe("make it blue");
    expect(next.blocks[0].msgs).toHaveLength(1);
  });

  it("reconnect replay: this turn's matching prompt.req clears the optimistic bubble", () => {
    const block = { msgs: [] };
    const state = baseState({
      optimisticPrompt: "make it blue",
      inFlightStreamId: "p-2",
      blocks: [block],
      current: block,
    });
    const next = promptReducer(state, promptReq("p-2", "make it blue"));
    expect(next.optimisticPrompt).toBeUndefined();
    expect(next.blocks[0].msgs).toHaveLength(1);
  });

  it("clearChat clears the optimistic bubble", () => {
    const state = baseState({ optimisticPrompt: "make it blue" });
    const next = promptReducer(state, { type: "clearChat", appSlug: "other" });
    expect(next.optimisticPrompt).toBeUndefined();
  });
});
