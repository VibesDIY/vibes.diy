import { describe, expect, it } from "vitest";
import { buildRecoveryRequest, shouldAttemptRecovery, updateRecoveryCounter } from "@vibes.diy/api-svc";
import type { LLMRequest } from "@vibes.diy/call-ai-v2";

describe("buildRecoveryRequest (continue mode: 'you were here')", () => {
  const baseReq: LLMRequest = {
    model: "test/model",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "make a button" }],
      },
    ],
  };

  it("appends a system message with CURRENT FILES and a continue prompt; says nothing about failure", () => {
    const vfs = new Map<string, string>([["/App.jsx", "function App() { return <h1>hi</h1>; }"]]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs,
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const out = r.Ok();
    expect(out.messages).toHaveLength(2);
    const last = out.messages[1];
    expect(last.role).toBe("system");
    const text = last.content[0].type === "text" ? last.content[0].text : "";
    expect(text).toContain("You were here. Continue.");
    expect(text).toContain("CURRENT FILES");
    expect(text).toContain("/App.jsx");
    // Continue mode: no failure framing leaks into the prompt. The model
    // doesn't see "FAILED" / "error" / "retry" / fence markers, and isn't
    // told there was an interrupted edit to avoid.
    expect(text).not.toMatch(/FAILED/i);
    expect(text).not.toMatch(/\berror\b/i);
    expect(text).not.toMatch(/\bretry\b/i);
    expect(text).not.toContain("<<<<<<< SEARCH");
    expect(text).not.toContain(">>>>>>> SEARCH");
    expect(text).not.toContain(">>>>>>> REPLACE");
  });

  it("renders the focus file first so the model sees its full contents under the per-file budget", () => {
    const vfs = new Map<string, string>([
      ["/aux.ts", "export const aux = 'irrelevant';"],
      ["/App.jsx", "function App() { return <h1>important</h1>; }"],
    ]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs,
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const text = (() => {
      const last = r.Ok().messages[1];
      return last.content[0].type === "text" ? last.content[0].text : "";
    })();
    const appIdx = text.indexOf("/App.jsx");
    const auxIdx = text.indexOf("/aux.ts");
    expect(appIdx).toBeGreaterThan(-1);
    expect(auxIdx).toBeGreaterThan(-1);
    expect(appIdx).toBeLessThan(auxIdx);
  });

  it("truncates oversize files with an explicit marker rather than dropping them silently", () => {
    const huge = "x".repeat(20_000);
    const vfs = new Map<string, string>([["/App.jsx", huge]]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs,
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const text = (() => {
      const last = r.Ok().messages[1];
      return last.content[0].type === "text" ? last.content[0].text : "";
    })();
    expect(text).toContain("/App.jsx (truncated:");
    expect(text).toContain("(truncated above)");
    expect(text.length).toBeLessThan(20_000 + 2_000);
  });

  // The orchestrator captures the upstream tokens emitted before the apply
  // error, truncated to the last successful code.end (NOT the last line
  // boundary — see notes), and injects them as an assistant message. The
  // model sees its own voice ending at a clean code-block close, then a
  // system "you were here, continue" prompt. The model has no signal that a
  // failure occurred; it just continues from the visible state.
  describe("assistantPartial (resume handoff)", () => {
    const partial = [
      "Building Quick Notes — top features:",
      "1. Title field (done)",
      "```jsx",
      "export default function App() { return null; }",
      "```",
    ].join("\n");

    it("inserts the assistant partial between the original messages and the recovery system message", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "function App() { return null; }"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
      });
      expect(r.isOk()).toBe(true);
      const out = r.Ok();
      expect(out.messages).toHaveLength(3);
      expect(out.messages[0].role).toBe("user");
      expect(out.messages[1].role).toBe("assistant");
      expect(out.messages[2].role).toBe("system");
      const assistantText = out.messages[1].content[0].type === "text" ? out.messages[1].content[0].text : "";
      expect(assistantText).toBe(partial);
    });

    it("preserves the two-message shape when assistantPartial is omitted (no partial captured)", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
      });
      expect(r.isOk()).toBe(true);
      const out = r.Ok();
      expect(out.messages).toHaveLength(2);
      expect(out.messages[0].role).toBe("user");
      expect(out.messages[1].role).toBe("system");
    });

    it("treats an empty-string assistantPartial as omitted", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
        assistantPartial: "",
      });
      expect(r.isOk()).toBe(true);
      expect(r.Ok().messages).toHaveLength(2);
    });

    it("does not duplicate the partial text into the system message (assistant message is the canonical handoff)", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
      });
      expect(r.isOk()).toBe(true);
      const systemText = (() => {
        const sys = r.Ok().messages[2];
        return sys.content[0].type === "text" ? sys.content[0].text : "";
      })();
      expect(systemText).not.toContain("Building Quick Notes");
      expect(systemText).not.toContain("Title field (done)");
    });
  });

  it("returns Err when addendum is empty", () => {
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "",
      vfs: new Map(),
      focusPath: "/App.jsx",
    });
    expect(r.isErr()).toBe(true);
  });
});

// Recovery is bounded by *consecutive fruitless* attempts, not total
// attempts. The recovery prompt is stateless for the LLM — as long as the
// model is making progress (any clean apply during a recovery stream),
// the counter resets to 0. Only stuck loops where the model returns a
// malformed first block over and over trip the budget.
describe("updateRecoveryCounter", () => {
  it("resets to 0 when the recovery stream made progress (any clean apply)", () => {
    expect(updateRecoveryCounter({ consecutiveFruitless: 2 }, { madeProgress: true })).toEqual({
      consecutiveFruitless: 0,
    });
  });

  it("increments when the recovery stream produced no clean apply", () => {
    expect(updateRecoveryCounter({ consecutiveFruitless: 0 }, { madeProgress: false })).toEqual({
      consecutiveFruitless: 1,
    });
    expect(updateRecoveryCounter({ consecutiveFruitless: 1 }, { madeProgress: false })).toEqual({
      consecutiveFruitless: 2,
    });
  });

  it("treats progress as load-bearing — even a single clean apply resets", () => {
    // Recovery stream emits one good block then a bad block — counter resets.
    // The bad block triggers another recovery, but we start fresh from 0.
    const after = updateRecoveryCounter({ consecutiveFruitless: 2 }, { madeProgress: true });
    expect(after.consecutiveFruitless).toBe(0);
  });
});

describe("shouldAttemptRecovery", () => {
  it("allows when consecutive fruitless count is below the limit", () => {
    expect(shouldAttemptRecovery({ consecutiveFruitless: 0 })).toBe(true);
    expect(shouldAttemptRecovery({ consecutiveFruitless: 2 })).toBe(true);
  });

  it("rejects at and above the default limit (3)", () => {
    expect(shouldAttemptRecovery({ consecutiveFruitless: 3 })).toBe(false);
    expect(shouldAttemptRecovery({ consecutiveFruitless: 5 })).toBe(false);
  });

  it("respects a custom limit", () => {
    expect(shouldAttemptRecovery({ consecutiveFruitless: 4 }, { maxConsecutiveFruitless: 5 })).toBe(true);
    expect(shouldAttemptRecovery({ consecutiveFruitless: 5 }, { maxConsecutiveFruitless: 5 })).toBe(false);
  });
});
