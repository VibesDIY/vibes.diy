import { describe, it, expect } from "vitest";
import { promptReducer, type PromptState } from "../app/routes/chat/prompt-state.js";
import type { LLMChatEntry } from "@vibes.diy/api-types";

// Codegen admission-roll recovery (cold-start design, #2829). When chat.prompt()
// returns `shard-overloaded`, the client rolls to the next shard and drops the
// socket BEFORE any block arrives (running=false, no inFlightStreamId). A bare
// `streamDisconnected` is a no-op in that idle state, so the chat would strand on
// a context-less socket. `rollReconnect` must FORCE reconnect so the chat reopens
// on the rolled shard. These tests pin that contrast.

function idleLiveState(): PromptState {
  return {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: "t",
    blocks: [],
    searchParams: new URLSearchParams(),
    setSearchParams: () => undefined,
    agentSavedBlockIds: new Set<string>(),
    connection: "live",
    inFlightStreamId: undefined,
  } as unknown as PromptState;
}

describe("promptReducer — rollReconnect (admission-roll recovery)", () => {
  it("forces reconnecting from an idle live state (where streamDisconnected no-ops)", () => {
    const idle = idleLiveState();

    // Baseline: a bare disconnect while idle is dropped — connection stays live.
    expect(promptReducer(idle, { type: "streamDisconnected" }).connection).toBe("live");

    // rollReconnect forces it regardless of turn state.
    expect(promptReducer(idle, { type: "rollReconnect" }).connection).toBe("reconnecting");
  });

  it("is idempotent when already reconnecting", () => {
    const reconnecting = { ...idleLiveState(), connection: "reconnecting" as const };
    const next = promptReducer(reconnecting, { type: "rollReconnect" });
    expect(next.connection).toBe("reconnecting");
    expect(next).toBe(reconnecting); // same reference — no spurious state churn
  });

  it("does not clobber other state when forcing reconnect", () => {
    const idle = { ...idleLiveState(), title: "keep-me", hasCode: true };
    const next = promptReducer(idle, { type: "rollReconnect" });
    expect(next.connection).toBe("reconnecting");
    expect(next.title).toBe("keep-me");
    expect(next.hasCode).toBe(true);
  });
});
