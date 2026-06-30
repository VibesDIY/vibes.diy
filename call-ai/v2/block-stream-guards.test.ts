import { describe, expect, it } from "vitest";
import { isCodeLine, isToplevelLine, type ToplevelLineMsg } from "./block-stream.js";

// Regression for VibesDIY/vibes.diy#2707: the block-stream type guards take an
// optional `streamId` second arg. When used *bare* as an Array.filter/map/some
// callback, JS supplies the element index in that slot. TypeScript already
// rejects passing a guard bare to a typed `.filter` (the `streamId?: string`
// slot is incompatible with `index: number`), so that route is a compile-time
// guard rail. This pins the *runtime* hardening that protects untyped callers
// (plain JS, `as any` arrays): a numeric second arg must be ignored, so the
// guard behaves as a pure shape check rather than silently keeping only index 0.

// Shape of an Array iteration callback. Casting a guard to this mirrors what an
// untyped `.filter(isToplevelLine)` does at runtime: it gets called (value, index).
type BareGuard = (value: unknown, index: number, array: readonly unknown[]) => boolean;

const toplevelLine = (i: number, streamId = "stream-A"): ToplevelLineMsg => ({
  type: "block.toplevel.line",
  sectionId: "sec-1",
  blockId: "blk-1",
  streamId,
  seq: i,
  blockNr: 0,
  timestamp: new Date(0),
  lineNr: i,
  line: `line ${i}`,
});

describe("block-stream guard streamId footgun (#2707)", () => {
  it("a numeric second arg (the index Array.filter supplies) is a no-op", () => {
    const line = toplevelLine(5);
    // Index 0 was always fine; index >= 1 used to require streamId === <number>.
    expect(isToplevelLine(line, 0 as unknown as string)).toBe(true);
    expect(isToplevelLine(line, 1 as unknown as string)).toBe(true);
    expect(isToplevelLine(line, 2 as unknown as string)).toBe(true);
  });

  it("isToplevelLine used bare as an Array.filter callback keeps every match", () => {
    const lines = [toplevelLine(0), toplevelLine(1), toplevelLine(2)];
    const bare = isToplevelLine as unknown as BareGuard;
    expect(lines.filter(bare)).toHaveLength(3);
  });

  it("isCodeLine used bare still rejects non-matching shapes", () => {
    const lines = [toplevelLine(0), toplevelLine(1)];
    const bare = isCodeLine as unknown as BareGuard;
    expect(lines.filter(bare)).toHaveLength(0);
  });

  it("an explicit string streamId still scopes the match", () => {
    const lines = [toplevelLine(0, "stream-A"), toplevelLine(1, "stream-B")];
    expect(lines.filter((l) => isToplevelLine(l, "stream-A"))).toHaveLength(1);
    expect(lines.filter((l) => isToplevelLine(l, "stream-B"))).toHaveLength(1);
    expect(lines.filter((l) => isToplevelLine(l, "stream-Z"))).toHaveLength(0);
  });
});
