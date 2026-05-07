import { describe, expect, it } from "vitest";
import { buildRecoveryRequest, shouldAttemptRecovery, updateRecoveryCounter } from "@vibes.diy/api-svc";
import type { LLMRequest } from "@vibes.diy/call-ai-v2";

describe("buildRecoveryRequest (continue mode: 'you were here')", () => {
  // Original turn shape used in production: a system message (with the base
  // system prompt) followed by user turns. Recovery merges its addendum +
  // CURRENT FILES into that single system message rather than appending a
  // second one — many providers reject back-to-back system messages.
  const baseSystemText = "You are a Vibes app builder. Use SEARCH/REPLACE blocks for edits.";
  const baseReq: LLMRequest = {
    model: "test/model",
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: baseSystemText }],
      },
      {
        role: "user",
        content: [{ type: "text", text: "make a button" }],
      },
    ],
  };
  const userOnlyReq: LLMRequest = {
    model: "test/model",
    messages: [{ role: "user", content: [{ type: "text", text: "make a button" }] }],
  };

  it("merges addendum + CURRENT FILES into the original system message and says nothing about failure", () => {
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
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[1].role).toBe("user");
    const sysText = out.messages[0].content[0].type === "text" ? out.messages[0].content[0].text : "";
    expect(sysText).toContain(baseSystemText);
    expect(sysText).toContain("You were here. Continue.");
    expect(sysText).toContain("CURRENT FILES");
    expect(sysText).toContain("/App.jsx");
    // Continue mode: no failure framing leaks into the prompt.
    expect(sysText).not.toMatch(/FAILED/i);
    expect(sysText).not.toMatch(/\berror\b/i);
    expect(sysText).not.toMatch(/\bretry\b/i);
    expect(sysText).not.toContain("<<<<<<< SEARCH");
    expect(sysText).not.toContain(">>>>>>> SEARCH");
    expect(sysText).not.toContain(">>>>>>> REPLACE");
  });

  it("preserves message count when merging — exactly one system message in the output", () => {
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs: new Map([["/App.jsx", "x"]]),
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const out = r.Ok();
    const systemMessages = out.messages.filter((m) => m.role === "system");
    expect(systemMessages).toHaveLength(1);
  });

  it("prepends a new system message when the original request has none", () => {
    const r = buildRecoveryRequest({
      originalRequest: userOnlyReq,
      recoveryAddendum: "You were here. Continue.",
      vfs: new Map([["/App.jsx", "x"]]),
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const out = r.Ok();
    expect(out.messages).toHaveLength(2);
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[1].role).toBe("user");
  });

  it("renders the focus file first under the per-file budget", () => {
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
    const sysText = (() => {
      const sys = r.Ok().messages[0];
      return sys.content[0].type === "text" ? sys.content[0].text : "";
    })();
    const appIdx = sysText.indexOf("/App.jsx");
    const auxIdx = sysText.indexOf("/aux.ts");
    expect(appIdx).toBeGreaterThan(-1);
    expect(auxIdx).toBeGreaterThan(-1);
    expect(appIdx).toBeLessThan(auxIdx);
  });

  it("truncates oversize files with an explicit marker", () => {
    const huge = "x".repeat(20_000);
    const vfs = new Map<string, string>([["/App.jsx", huge]]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs,
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const sysText = (() => {
      const sys = r.Ok().messages[0];
      return sys.content[0].type === "text" ? sys.content[0].text : "";
    })();
    expect(sysText).toContain("/App.jsx (truncated:");
    expect(sysText).toContain("(truncated above)");
    expect(sysText.length).toBeLessThan(20_000 + 4_000);
  });

  // The orchestrator captures the upstream tokens emitted before the apply
  // error, truncated to the last successful code.end, and injects them as
  // an ASSISTANT prefill message after the user turn. The model continues
  // its own message at the token level — there is no narrator step that
  // can lie about what already landed.
  describe("assistantPartial (assistant prefill)", () => {
    const partial = [
      "Building Quick Notes — top features:",
      "1. Title field (done)",
      "```jsx",
      "export default function App() { return null; }",
      "```",
    ].join("\n");

    it("appends the partial as an assistant prefill message (raw, no wrapper prose)", () => {
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
      expect(out.messages[0].role).toBe("system");
      expect(out.messages[1].role).toBe("user");
      // Prefill: the conversation ends on an ASSISTANT turn whose content is
      // literally the captured partial. The next sampled token is the model's
      // continuation of its own message — no "you said this" narration.
      expect(out.messages[2].role).toBe("assistant");
      const lastText = out.messages[2].content[0].type === "text" ? out.messages[2].content[0].text : "";
      expect(lastText).toBe(partial);
      // No wrapper prose — that would re-introduce the meta-narration that
      // the prefill design exists to eliminate.
      expect(lastText).not.toContain("PARTIAL ASSISTANT OUTPUT");
      expect(lastText).not.toContain("Continue from where");
    });

    it("pins provider preference to avoid Bedrock when prefilling", () => {
      // Bedrock-routed Claude rejects assistant-suffix conversations with
      // 400 ("This model does not support assistant message prefill").
      // OpenRouter must route this recovery call to Anthropic-direct or
      // Vertex instead. Observed live in chat zYFWaxhUAKSvVrzeL.
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
      });
      expect(r.isOk()).toBe(true);
      const out = r.Ok();
      expect(out.provider?.ignore).toContain("amazon-bedrock");
    });

    it("does not pin provider preference when no prefill is appended", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
      });
      expect(r.isOk()).toBe(true);
      expect(r.Ok().provider).toBeUndefined();
    });

    it("preserves the two-message shape when assistantPartial is omitted", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
      });
      expect(r.isOk()).toBe(true);
      const out = r.Ok();
      expect(out.messages).toHaveLength(2);
      expect(out.messages[0].role).toBe("system");
      expect(out.messages[1].role).toBe("user");
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

    it("does not duplicate the partial text into the system message", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
      });
      expect(r.isOk()).toBe(true);
      const sysText = (() => {
        const sys = r.Ok().messages[0];
        return sys.content[0].type === "text" ? sys.content[0].text : "";
      })();
      expect(sysText).not.toContain("Building Quick Notes");
      expect(sysText).not.toContain("Title field (done)");
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
