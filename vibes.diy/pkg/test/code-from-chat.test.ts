import { describe, it, expect } from "vitest";
import { resolveCodeView } from "../app/components/vibe-editor/code-from-chat.js";
import type { PromptState } from "../app/routes/chat/prompt-state.js";
function emptyState(): PromptState {
  return { blocks: [], hasCode: false } as unknown as PromptState;
}
describe("resolveCodeView", () => {
  it("returns no files for an un-generated vibe", () => {
    const r = resolveCodeView(emptyState());
    expect(r.files).toEqual([]);
    expect(r.activeFile).toBeUndefined();
    expect(r.activeCode).toBe("");
  });
});
