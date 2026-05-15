import { describe, it, expect } from "vitest";
import type { LLMChatEntry } from "@vibes.diy/api-types";
import type { PromptState } from "../../pkg/app/routes/chat/chat.$userSlug.$appSlug.js";
import { buildClonedSourceSelected } from "../../pkg/app/utils/firstTurnClonePromptOpts.js";

function makeState(overrides: Partial<PromptState> = {}): PromptState {
  return {
    chat: {} as LLMChatEntry,
    running: false,
    hasCode: false,
    title: "app",
    blocks: [],
    searchParams: new URLSearchParams(),
    setSearchParams: () => undefined,
    agentSavedBlockIds: new Set<string>(),
    ...overrides,
  };
}

describe("buildClonedSourceSelected", () => {
  it("returns a draft slot when chat is empty and hydratedSource matches fsId", () => {
    const state = makeState({
      hydratedSource: { fsId: "fs-abc", code: ["function App(){", "  return null;", "}"] },
    });
    const sel = buildClonedSourceSelected(state, "fs-abc");
    expect(sel).toEqual({
      kind: "draft",
      files: [
        {
          type: "code-block",
          filename: "/App.jsx",
          lang: "jsx",
          content: "function App(){\n  return null;\n}",
        },
      ],
    });
  });

  it("returns undefined when there is no hydratedSource", () => {
    const state = makeState();
    expect(buildClonedSourceSelected(state, "fs-abc")).toBeUndefined();
  });

  it("returns undefined when hydratedSource.fsId does not match", () => {
    const state = makeState({
      hydratedSource: { fsId: "fs-other", code: ["x"] },
    });
    expect(buildClonedSourceSelected(state, "fs-abc")).toBeUndefined();
  });

  it("returns undefined when the chat already has prior blocks (follow-up turn)", () => {
    const state = makeState({
      blocks: [{ msgs: [] }],
      hydratedSource: { fsId: "fs-abc", code: ["x"] },
    });
    expect(buildClonedSourceSelected(state, "fs-abc")).toBeUndefined();
  });

  it("returns undefined when fsId is undefined", () => {
    const state = makeState({
      hydratedSource: { fsId: "fs-abc", code: ["x"] },
    });
    expect(buildClonedSourceSelected(state, undefined)).toBeUndefined();
  });
});
