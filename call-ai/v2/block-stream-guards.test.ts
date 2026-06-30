import { describe, expect, it } from "vitest";
import { isCodeLine, isToplevelLine, type ToplevelLineMsg } from "./block-stream.js";

// Regression for VibesDIY/vibes.diy#2707: the block-stream type guards take an
// optional `streamId` second arg. When passed *bare* as an Array.filter/map/
// some callback, JS supplies the element index in that slot. The guards must
// ignore a non-string second arg so a bare `.filter(isToplevelLine)` keeps every
// matching element rather than only index 0.

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
  it("isToplevelLine passed bare to Array.filter keeps every matching element", () => {
    const lines = [toplevelLine(0), toplevelLine(1), toplevelLine(2)];
    expect(lines.filter(isToplevelLine)).toHaveLength(3);
  });

  it("isToplevelLine passed bare to Array.some/find ignores the index arg", () => {
    const lines = [toplevelLine(0), toplevelLine(1)];
    expect(lines.some(isToplevelLine)).toBe(true);
    expect(lines.find(isToplevelLine)).toBe(lines[0]);
  });

  it("isCodeLine passed bare to Array.filter rejects non-matching shapes", () => {
    const mixed = [toplevelLine(0), toplevelLine(1)];
    expect(mixed.filter(isCodeLine)).toHaveLength(0);
  });

  it("an explicit string streamId still scopes the match", () => {
    const lines = [toplevelLine(0, "stream-A"), toplevelLine(1, "stream-B")];
    expect(lines.filter((l) => isToplevelLine(l, "stream-A"))).toHaveLength(1);
    expect(lines.filter((l) => isToplevelLine(l, "stream-B"))).toHaveLength(1);
    expect(lines.filter((l) => isToplevelLine(l, "stream-Z"))).toHaveLength(0);
  });
});
