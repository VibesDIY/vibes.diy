import { describe, expect, it } from "vitest";
import { buildRecoveryRequest, tryConsumeRecovery } from "@vibes.diy/api-svc";
import type { LLMRequest } from "@vibes.diy/call-ai-v2";

describe("buildRecoveryRequest", () => {
  const baseReq: LLMRequest = {
    model: "test/model",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "make a button" }],
      },
    ],
  };

  it("appends a system message with CURRENT FILES and FAILED EDIT", () => {
    const vfs = new Map<string, string>([["/App.jsx", "function App() { return <h1>hi</h1>; }"]]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "Recover gracefully.",
      vfs,
      failedPath: "/App.jsx",
      failedSearch: "<h1>missing</h1>",
      failedReason: "no-match",
    });
    expect(r.isOk()).toBe(true);
    const out = r.Ok();
    expect(out.messages).toHaveLength(2);
    const last = out.messages[1];
    expect(last.role).toBe("system");
    const text = last.content[0].type === "text" ? last.content[0].text : "";
    expect(text).toContain("Recover gracefully.");
    expect(text).toContain("CURRENT FILES");
    expect(text).toContain("/App.jsx");
    expect(text).toContain("FAILED EDIT");
    expect(text).toContain("no-match");
    expect(text).toContain("<h1>missing</h1>");
  });

  it("renders the failed file first so the model sees its full contents under the per-file budget", () => {
    const vfs = new Map<string, string>([
      ["/aux.ts", "export const aux = 'irrelevant';"],
      ["/App.jsx", "function App() { return <h1>important</h1>; }"],
    ]);
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "Recover gracefully.",
      vfs,
      failedPath: "/App.jsx",
      failedSearch: "x",
      failedReason: "no-match",
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
      recoveryAddendum: "Recover gracefully.",
      vfs,
      failedPath: "/App.jsx",
      failedSearch: "x",
      failedReason: "no-match",
    });
    expect(r.isOk()).toBe(true);
    const text = (() => {
      const last = r.Ok().messages[1];
      return last.content[0].type === "text" ? last.content[0].text : "";
    })();
    expect(text).toContain("/App.jsx (truncated:");
    expect(text).toContain("(truncated above)");
    // Must include some file content but not the entire 20k-byte original.
    expect(text.length).toBeLessThan(20_000 + 2_000);
  });

  it("uses a non-fence delimiter for the failed-search block so the model isn't tempted to mirror the marker", () => {
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "Recover gracefully.",
      vfs: new Map([["/App.jsx", "x"]]),
      failedPath: "/App.jsx",
      failedSearch: "missing",
      failedReason: "no-match",
    });
    expect(r.isOk()).toBe(true);
    const text = (() => {
      const last = r.Ok().messages[1];
      return last.content[0].type === "text" ? last.content[0].text : "";
    })();
    expect(text).not.toContain(">>>>>>> SEARCH");
    expect(text).not.toContain(">>>>>>> REPLACE");
    expect(text).toContain("--- failed search text ---");
  });

  it("returns Err when addendum is empty", () => {
    const r = buildRecoveryRequest({
      originalRequest: baseReq,
      recoveryAddendum: "",
      vfs: new Map(),
      failedPath: "/App.jsx",
      failedSearch: "x",
      failedReason: "no-match",
    });
    expect(r.isErr()).toBe(true);
  });
});

describe("tryConsumeRecovery", () => {
  it("allows the first attempt", () => {
    const r = tryConsumeRecovery({ attempts: 0 });
    expect(r.allowed).toBe(true);
    expect(r.next.attempts).toBe(1);
  });

  it("rejects the second attempt by default", () => {
    const r = tryConsumeRecovery({ attempts: 1 });
    expect(r.allowed).toBe(false);
    expect(r.next.attempts).toBe(1);
  });

  it("respects a larger budget", () => {
    const r = tryConsumeRecovery({ attempts: 1 }, { maxAttempts: 2 });
    expect(r.allowed).toBe(true);
    expect(r.next.attempts).toBe(2);
  });
});
