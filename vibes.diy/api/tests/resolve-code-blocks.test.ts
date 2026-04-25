import { describe, expect, it } from "vitest";
import { resolveCodeBlocksToFileSystem } from "@vibes.diy/api-svc";
import type { CodeBeginMsg, CodeLineMsg, CodeEndMsg } from "@vibes.diy/call-ai-v2";
import type { VibeFile } from "@vibes.diy/api-types";

function contentOf(f: VibeFile): string {
  if (f.type !== "code-block") throw new Error(`expected code-block, got ${f.type}`);
  return f.content;
}

const ts = new Date("2026-04-25T00:00:00Z");

function makeBlock(lines: string[], path = "App.jsx"): { begin: CodeBeginMsg; lines: CodeLineMsg[]; end: CodeEndMsg } {
  return {
    begin: {
      type: "block.code.begin",
      blockId: "blk",
      blockNr: 1,
      streamId: "stream",
      seq: 1,
      timestamp: ts,
      sectionId: "sec",
      lang: "jsx",
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
          'export default function App() {',
          '  return (',
          '    <div>',
          '      <button>ADD</button>',
          '    </div>',
          '  );',
          '}',
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
