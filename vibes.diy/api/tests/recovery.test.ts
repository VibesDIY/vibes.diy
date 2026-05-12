import { describe, expect, it } from "vitest";
import { buildRecoveryRequest, renderCurrentFiles, shouldAttemptRecovery, updateRecoveryCounter } from "@vibes.diy/api-svc";
import type { ChatMessage, LLMRequest } from "@vibes.diy/call-ai-v2";

function textOf(msg: ChatMessage | undefined): string {
  if (msg === undefined) return "";
  const part = msg.content[0];
  return part?.type === "text" ? part.text : "";
}

describe("buildRecoveryRequest (continue mode: 'you were here')", () => {
  // Original turn shape used in production: a system message (with the base
  // system prompt) followed by user turns. Recovery merges the addendum into
  // that single system message rather than appending a second one — many
  // providers reject back-to-back system messages with 400. File state is
  // rendered as a RECOVERY_PARTIAL user-role slot message (the slot
  // architecture's canonical home for recovery turns), not inlined into the
  // system prompt.
  const baseSystemText = "You are a Vibes app builder. Use SEARCH/REPLACE blocks for edits.";
  const baseReq: LLMRequest = {
    model: "test/model",
    messages: [
      { role: "system", content: [{ type: "text", text: baseSystemText }] },
      { role: "user", content: [{ type: "text", text: "make a button" }] },
    ],
  };
  const userOnlyReq: LLMRequest = {
    model: "test/model",
    messages: [{ role: "user", content: [{ type: "text", text: "make a button" }] }],
  };

  it("merges addendum into system, renders file state as RECOVERY_PARTIAL slot user message", () => {
    const vfs = new Map<string, string>([["/App.jsx", "function App() { return <h1>hi</h1>; }"]]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs,
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const out = r.Ok();
    // Shape: [system+addendum, original-user, slot-user]
    expect(out.messages).toHaveLength(3);
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[1].role).toBe("user");
    expect(out.messages[2].role).toBe("user");

    const sysText = textOf(out.messages[0]);
    expect(sysText).toContain(baseSystemText);
    expect(sysText).toContain("You were here. Continue.");
    // CURRENT FILES no longer leaks into the system message.
    expect(sysText).not.toContain("CURRENT FILES");
    expect(sysText).not.toContain("/App.jsx");
    // Continue mode: no failure framing leaks into the prompt.
    expect(sysText).not.toMatch(/FAILED/i);
    expect(sysText).not.toMatch(/\berror\b/i);
    expect(sysText).not.toMatch(/\bretry\b/i);
    expect(sysText).not.toContain("<<<<<<< SEARCH");
    expect(sysText).not.toContain(">>>>>>> SEARCH");
    expect(sysText).not.toContain(">>>>>>> REPLACE");

    // The slot user message carries RECOVERY_PARTIAL + the file body.
    const slotText = textOf(out.messages[2]);
    expect(slotText).toContain("RECOVERY_PARTIAL");
    expect(slotText).toContain("CURRENT FILES");
    expect(slotText).toContain("/App.jsx");
    expect(slotText).toContain("function App() { return <h1>hi</h1>; }");
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
    // [system-new, original-user, slot-user]
    expect(out.messages).toHaveLength(3);
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[1].role).toBe("user");
    expect(out.messages[2].role).toBe("user");
  });

  it("renders the focus file first inside the slot user message", () => {
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
    const slotText = textOf(r.Ok().messages[2]);
    const appIdx = slotText.indexOf("/App.jsx");
    const auxIdx = slotText.indexOf("/aux.ts");
    expect(appIdx).toBeGreaterThan(-1);
    expect(auxIdx).toBeGreaterThan(-1);
    expect(appIdx).toBeLessThan(auxIdx);
  });

  it("truncates oversize files with an explicit marker in the slot user message", () => {
    const huge = "x".repeat(20_000);
    const vfs = new Map<string, string>([["/App.jsx", huge]]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs,
      focusPath: "/App.jsx",
    });
    expect(r.isOk()).toBe(true);
    const slotText = textOf(r.Ok().messages[2]);
    expect(slotText).toContain("/App.jsx (truncated:");
    expect(slotText).toContain("(truncated above)");
    expect(slotText.length).toBeLessThan(20_000 + 4_000);
  });

  // The orchestrator captures the upstream tokens emitted before the apply
  // error, truncated to the start of the failed edit block, and injects
  // them as a USER-role resume message AFTER the slot user message. We tried
  // assistant-prefill (commit 80260adb) and it was rejected at the model
  // level by anthropic/claude-opus-4.7 across every OpenRouter provider —
  // so we keep the user-framed wrapper which works on every model.
  describe("assistantPartial (user-framed resume handoff)", () => {
    const partial = [
      "Building Quick Notes — top features:",
      "1. Title field (done)",
      "```jsx",
      "export default function App() { return null; }",
      "```",
    ].join("\n");

    it("appends a quiet partial-resume message after the slot user message", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "function App() { return null; }"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
      });
      expect(r.isOk()).toBe(true);
      const out = r.Ok();
      // [system+addendum, original-user, slot-user, partial-resume-user]
      expect(out.messages).toHaveLength(4);
      expect(out.messages[0].role).toBe("system");
      expect(out.messages[1].role).toBe("user");
      expect(out.messages[2].role).toBe("user");
      // The conversation must end with a user message — the model
      // (anthropic/claude-opus-4.7) refuses assistant-suffix conversations.
      expect(out.messages[3].role).toBe("user");
      const lastText = textOf(out.messages[3]);
      expect(lastText).toContain(partial);
      // Quiet framing: tell the model the partial ends at last good code
      // block, hand off, point at the file state. No "redo the failed
      // edit" pressure, no "verify each described edit" — those instructions
      // invited the gaslight pattern.
      expect(lastText).toMatch(/last successfully-applied code block/i);
      expect(lastText).toMatch(/continue your turn/i);
      expect(lastText).not.toContain("<<<FAILED EDIT HERE>>>");
      expect(lastText).not.toMatch(/redo (the |that )?failed/i);
      expect(lastText).not.toMatch(/verify .* landed/i);
    });

    it("cites the file line count after the last successful SEARCH/REPLACE", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
        lastReplaceFileLines: 142,
      });
      expect(r.isOk()).toBe(true);
      const lastText = textOf(r.Ok().messages[3]);
      expect(lastText).toContain("142 lines");
      expect(lastText).toContain("/App.jsx");
      expect(lastText).toMatch(/SEARCH\/REPLACE/);
    });

    it("omits the line-count anchor when the last successful block was a create", () => {
      // create blocks (full-file rewrites) don't have a meaningful "ended
      // at line N" anchor — N is just the file's total line count, not
      // an in-file position the model needs to reason about.
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
      });
      expect(r.isOk()).toBe(true);
      const lastText = textOf(r.Ok().messages[3]);
      expect(lastText).not.toMatch(/\bline(s)? long/);
      expect(lastText).not.toMatch(/SEARCH\/REPLACE on /);
    });

    it("preserves the three-message shape when assistantPartial is omitted", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
      });
      expect(r.isOk()).toBe(true);
      const out = r.Ok();
      // [system+addendum, original-user, slot-user]
      expect(out.messages).toHaveLength(3);
      expect(out.messages[0].role).toBe("system");
      expect(out.messages[1].role).toBe("user");
      expect(out.messages[2].role).toBe("user");
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
      expect(r.Ok().messages).toHaveLength(3);
    });

    it("does not duplicate the partial text into the system message or slot", () => {
      const r = buildRecoveryRequest({
        originalRequest: baseReq,
        recoveryAddendum: "You were here. Continue.",
        vfs: new Map([["/App.jsx", "x"]]),
        focusPath: "/App.jsx",
        assistantPartial: partial,
      });
      expect(r.isOk()).toBe(true);
      const sysText = textOf(r.Ok().messages[0]);
      const slotText = textOf(r.Ok().messages[2]);
      expect(sysText).not.toContain("Building Quick Notes");
      expect(sysText).not.toContain("Title field (done)");
      expect(slotText).not.toContain("Building Quick Notes");
      expect(slotText).not.toContain("Title field (done)");
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

  it("returns Err when focus path is empty", () => {
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "You were here. Continue.",
      vfs: new Map(),
      focusPath: "",
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

describe("renderCurrentFiles (re-used by slot-assembler's RECOVERY_PARTIAL renderer)", () => {
  // The helper is exported because the slot assembler calls it to render
  // file content inside the RECOVERY_PARTIAL slot user message. Without it
  // the model would see only its own prior SEARCH/REPLACE patches replayed
  // as text and have to mentally chain them to guess the file state —
  // SEARCH anchors emitted against that guess miss, server-side recovery
  // exhausts after 3 fruitless retries, and the turn finalizes with zero
  // snapshots.
  it("includes a CURRENT FILES header and renders each file under a path marker", () => {
    const vfs = new Map<string, string>([
      ["/App.jsx", "export default () => <h1>hi</h1>;"],
      ["/Helpers.jsx", "export const greet = () => 'hi';"],
    ]);
    const out = renderCurrentFiles(vfs, "/App.jsx");
    expect(out).toContain("CURRENT FILES");
    expect(out).toContain("--- /App.jsx ---");
    expect(out).toContain("export default () => <h1>hi</h1>;");
    expect(out).toContain("--- /Helpers.jsx ---");
    expect(out).toContain("export const greet = () => 'hi';");
  });

  it("orders the focus file first so the model's working file leads the context", () => {
    const vfs = new Map<string, string>([
      ["/Aux.jsx", "// aux"],
      ["/App.jsx", "// app"],
    ]);
    const out = renderCurrentFiles(vfs, "/App.jsx");
    expect(out.indexOf("--- /App.jsx ---")).toBeLessThan(out.indexOf("--- /Aux.jsx ---"));
  });
});
