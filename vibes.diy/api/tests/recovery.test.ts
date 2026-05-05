import { describe, expect, it } from "vitest";
import { applyOneBlockToVfs, buildRecoveryRequest, tryConsumeRecovery, type CodeBlock } from "@vibes.diy/api-svc";
import type { CodeBeginMsg, CodeEndMsg, CodeLineMsg, LLMRequest } from "@vibes.diy/call-ai-v2";

const ts = new Date("2026-04-25T00:00:00Z");

function makeBlock(lines: string[], path = "App.jsx"): CodeBlock {
  const begin: CodeBeginMsg = {
    type: "block.code.begin",
    blockId: "blk",
    blockNr: 1,
    streamId: "stream",
    seq: 1,
    timestamp: ts,
    sectionId: "sec",
    lang: "jsx",
    path,
  };
  const lineMsgs: CodeLineMsg[] = lines.map((line, i) => ({
    type: "block.code.line",
    blockId: "blk",
    blockNr: 1,
    streamId: "stream",
    seq: 2,
    timestamp: ts,
    sectionId: "sec",
    lang: "jsx",
    path,
    line,
    lineNr: i + 1,
  }));
  const end: CodeEndMsg = {
    type: "block.code.end",
    blockId: "blk",
    blockNr: 1,
    streamId: "stream",
    seq: 3,
    timestamp: ts,
    sectionId: "sec",
    lang: "jsx",
    path,
    stats: { lines: 0, bytes: 0 },
  };
  return { begin, lines: lineMsgs, end };
}

describe("applyOneBlockToVfs", () => {
  it("applies a clean replace and returns no errors", () => {
    const vfs = new Map<string, string>([
      ["/App.jsx", ["export default function App() {", "  return <h1>old</h1>;", "}"].join("\n")],
    ]);
    const block = makeBlock(["<<<<<<< SEARCH", "  return <h1>old</h1>;", "=======", "  return <h1>new</h1>;", ">>>>>>> REPLACE"]);
    const step = applyOneBlockToVfs(vfs, block);
    expect(step.errors).toHaveLength(0);
    expect(step.path).toBe("/App.jsx");
    expect(vfs.get("/App.jsx")).toContain("<h1>new</h1>");
    expect(vfs.get("/App.jsx")).not.toContain("<h1>old</h1>");
  });

  it("reports a no-match error when SEARCH text is not present", () => {
    const vfs = new Map<string, string>([["/App.jsx", "export default function App() {}"]]);
    const block = makeBlock([
      "<<<<<<< SEARCH",
      "this text does not exist anywhere in the file",
      "=======",
      "replacement",
      ">>>>>>> REPLACE",
    ]);
    const step = applyOneBlockToVfs(vfs, block);
    expect(step.errors).toHaveLength(1);
    expect(step.errors[0].reason).toBe("no-match");
    expect(step.errors[0].search).toContain("this text does not exist");
  });

  it("treats a body without SEARCH markers as a create", () => {
    const vfs = new Map<string, string>();
    const block = makeBlock(["fresh content"], "src/foo.ts");
    const step = applyOneBlockToVfs(vfs, block);
    expect(step.errors).toHaveLength(0);
    expect(vfs.get("/src/foo.ts")).toBe("fresh content");
  });
});

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
