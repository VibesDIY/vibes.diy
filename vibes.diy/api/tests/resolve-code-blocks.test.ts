import { describe, expect, it } from "vitest";
import { resolveCodeBlocksToFileSystem } from "@vibes.diy/api-svc";
import type { CodeBeginMsg, CodeLineMsg, CodeEndMsg } from "@vibes.diy/call-ai-v2";
import type { VibeFile, VibeCodeBlock } from "@vibes.diy/api-types";

function contentOf(f: VibeFile): string {
  if (f.type !== "code-block") throw new Error(`expected code-block, got ${f.type}`);
  return f.content;
}

function langOf(f: VibeFile): string {
  if (f.type !== "code-block") throw new Error(`expected code-block, got ${f.type}`);
  return (f as VibeCodeBlock).lang;
}

const ts = new Date("2026-04-25T00:00:00Z");

function makeBlock(
  lines: string[],
  path = "App.jsx",
  lang = "jsx"
): { begin: CodeBeginMsg; lines: CodeLineMsg[]; end: CodeEndMsg } {
  return {
    begin: {
      type: "block.code.begin",
      blockId: "blk",
      blockNr: 1,
      streamId: "stream",
      seq: 1,
      timestamp: ts,
      sectionId: "sec",
      lang,
      path,
    },
    lines: lines.map((line, i) => ({
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
    })),
    end: {
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
    },
  };
}

describe("resolveCodeBlocksToFileSystem — aider seed", () => {
  it("a replace-only turn composes against the prior persisted seed", () => {
    // Prior turn already persisted /App.jsx with a button labelled ADD.
    // The new turn streams ONE replace block; without a seed the SEARCH
    // would fail and the resolver would persist 0 bytes (the dev bug).
    const seed = new Map<string, string>([
      [
        "/App.jsx",
        [
          "export default function App() {",
          "  return (",
          "    <div>",
          "      <button>ADD</button>",
          "    </div>",
          "  );",
          "}",
        ].join("\n"),
      ],
    ]);
    const replace = makeBlock([
      "<<<<<<< SEARCH",
      "      <button>ADD</button>",
      "=======",
      "      <button>LIST</button>",
      ">>>>>>> REPLACE",
    ]);
    const result = resolveCodeBlocksToFileSystem([replace], seed);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("/App.jsx");
    expect(contentOf(result[0])).toContain("export default function App()");
    expect(contentOf(result[0])).toContain("<button>LIST</button>");
    expect(contentOf(result[0])).not.toContain("<button>ADD</button>");
    expect(contentOf(result[0])).not.toContain("<<<<<<< SEARCH");
  });

  it("a create-only turn ignores the seed for that path (back-compat)", () => {
    const seed = new Map<string, string>([["/App.jsx", "old content"]]);
    const create = makeBlock(["export default function App() { return <h1>fresh</h1>; }"]);
    const result = resolveCodeBlocksToFileSystem([create], seed);
    expect(contentOf(result[0])).toContain("<h1>fresh</h1>");
    expect(contentOf(result[0])).not.toContain("old content");
  });

  it("preserves seeded files this turn did not touch", () => {
    const seed = new Map<string, string>([
      ["/App.jsx", "app content"],
      ["/sidecar.json", '{"a":1}'],
    ]);
    const create = makeBlock(["new app"]);
    const result = resolveCodeBlocksToFileSystem([create], seed);
    const byName = new Map(result.map((f) => [f.filename, contentOf(f)]));
    expect(byName.get("/App.jsx")).toBe("new app");
    expect(byName.get("/sidecar.json")).toBe('{"a":1}');
  });

  it("no seed: replace-only turn produces an empty file (regression marker)", () => {
    // Documents the dev bug we hit. Seed is required for replace turns to
    // produce the right content.
    const replace = makeBlock(["<<<<<<< SEARCH", "x", "=======", "y", ">>>>>>> REPLACE"]);
    const result = resolveCodeBlocksToFileSystem([replace]);
    expect(contentOf(result[0])).toBe("");
  });
});

describe("resolveCodeBlocksToFileSystem — multi-file (#2157)", () => {
  it("App.jsx and access.js both appear in the result", () => {
    const appBlock = makeBlock(["export default function App() { return <h1>Hello</h1>; }"]);
    const accessBlock = makeBlock(["export function boards(doc) { return doc; }"], "access.js", "js");
    const result = resolveCodeBlocksToFileSystem([appBlock, accessBlock]);
    expect(result).toHaveLength(2);
    const byName = new Map(result.map((f) => [f.filename, f]));
    expect(byName.has("/App.jsx")).toBe(true);
    expect(byName.has("/access.js")).toBe(true);
    expect(contentOf(byName.get("/App.jsx")!)).toContain("function App()");
    expect(contentOf(byName.get("/access.js")!)).toContain("function boards");
  });

  it("access.js gets lang 'js', not 'jsx' (#2157 lang normalization)", () => {
    const accessBlock = makeBlock(["export function boards(doc) { return doc; }"], "access.js", "js");
    const result = resolveCodeBlocksToFileSystem([accessBlock]);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("/access.js");
    expect(langOf(result[0])).toBe("js");
  });

  it("App.jsx keeps lang 'jsx' even when fence lang is 'js'", () => {
    const block = makeBlock(["export default function App() { return <h1>Hi</h1>; }"], "App.jsx", "js");
    const result = resolveCodeBlocksToFileSystem([block]);
    expect(langOf(result[0])).toBe("jsx");
  });

  it("seeded access.js carries forward with lang 'js'", () => {
    const seed = new Map<string, string>([
      ["/App.jsx", "app code"],
      ["/access.js", "export function boards(doc) { return doc; }"],
    ]);
    const appBlock = makeBlock(["new app code"]);
    const result = resolveCodeBlocksToFileSystem([appBlock], seed);
    const byName = new Map(result.map((f) => [f.filename, f]));
    expect(langOf(byName.get("/App.jsx")!)).toBe("jsx");
    expect(langOf(byName.get("/access.js")!)).toBe("js");
  });
});
