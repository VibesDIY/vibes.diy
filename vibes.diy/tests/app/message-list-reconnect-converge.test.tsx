import { describe, expect, it } from "vitest";
import { promptReducer } from "../../pkg/app/routes/chat/prompt-state.js";
import type { PromptState } from "../../pkg/app/routes/chat/prompt-state.js";

// Minimal PromptState for the reconnect-convergence tests. Only the fields the
// reducer reads in the `isBlockEnd` and `isStreamDisconnected` branches need to
// be populated; the rest are cast via `as never` to avoid importing heavy deps
// (URLSearchParams, SetURLSearchParams, LLMChatEntry) that are irrelevant here.
function reconnectingState(inFlightStreamId: string): PromptState {
  return {
    running: true,
    connection: "reconnecting",
    inFlightStreamId,
    blocks: [{ msgs: [] }],
    current: { msgs: [] },
  } as never as PromptState;
}

// Minimal block.end payload that satisfies the ArkType BlockEndMsg schema
// (isBlockEnd validates stats/usage/BlockBase at runtime).
const blockBase = { blockId: "b1", streamId: "p1", blockNr: 0, seq: 1, timestamp: new Date() };
const emptyStats = { lines: 0, bytes: 0 };
const blockEndStats = { toplevel: emptyStats, code: emptyStats, image: emptyStats, total: emptyStats };
const blockEndUsage = { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };

describe("reconnect convergence", () => {
  it("settles connection live on a block.end carrying fsRef for the in-flight stream", () => {
    const s0 = reconnectingState("p1");
    const s1 = promptReducer(s0, {
      type: "block.end",
      ...blockBase,
      stats: blockEndStats,
      usage: blockEndUsage,
      fsRef: { fsId: "fs-9", appSlug: "a", ownerHandle: "o", mode: "production" },
    } as never);
    expect(s1.connection).toBe("live");
    expect(s1.inFlightStreamId).toBeUndefined();
  });

  it("does NOT settle on a block.end lacking fsRef", () => {
    const s0 = reconnectingState("p1");
    const s1 = promptReducer(s0, {
      type: "block.end",
      ...blockBase,
      stats: blockEndStats,
      usage: blockEndUsage,
    } as never);
    expect(s1.connection).toBe("reconnecting");
  });
});
