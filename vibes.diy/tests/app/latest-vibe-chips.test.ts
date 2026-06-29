import { describe, it, expect } from "vitest";
import type { ResChatResponseTurn } from "@vibes.diy/api-types";
import { latestTurnChips, chipsFromNarration } from "../../pkg/app/hooks/useLatestVibeChips.js";

// Build a single `block.toplevel.line` event (the assistant narration carrier).
// Field set must satisfy the ToplevelLineMsg arktype schema so `isToplevelLine`
// (which validates, not just tag-checks) accepts it.
function line(text: string, lineNr: number): unknown {
  return {
    type: "block.toplevel.line",
    sectionId: "sec-1",
    blockId: "blk-1",
    streamId: "stream-1",
    seq: lineNr,
    blockNr: 0,
    timestamp: new Date("2026-06-27T00:00:00Z"),
    lineNr,
    line: text,
  };
}

// A non-toplevel block (a prompt echo) that must be ignored by the extractor.
function promptReq(): unknown {
  return { type: "prompt.req", streamId: "stream-1", prompt: "make a thing" };
}

function turn(created: string, lines: string[], extra: unknown[] = [], fsId?: string): ResChatResponseTurn {
  return {
    chatId: "chat-1",
    promptId: `p-${created}`,
    created,
    ...(fsId ? { fsId } : {}),
    sections: [{ blockSeq: 0, blocks: [...extra, ...lines.map((t, i) => line(t, i))] as never }],
  };
}

describe("latestTurnChips", () => {
  it("returns no chips when there are no turns", () => {
    expect(latestTurnChips([])).toEqual([]);
  });

  it("reads the newest turn (turns[0]) and parses its trailing ▸ options", () => {
    const newest = turn("2026-06-27T02:00:00Z", ["All set! Want a tweak?", "▸ Add sound", "▸ Add a timer"]);
    const older = turn("2026-06-27T01:00:00Z", ["Older turn", "▸ Should not appear"]);
    expect(latestTurnChips([newest, older])).toEqual(["Add sound", "Add a timer"]);
  });

  it('drops the terminal "I\'m done for now" chip', () => {
    const t = turn("2026-06-27T02:00:00Z", ["Done!", "▸ Add a high score", "▸ I'm done for now"]);
    expect(latestTurnChips([t])).toEqual(["Add a high score"]);
  });

  it("caps at three chips after dropping the terminal chip", () => {
    const t = turn("2026-06-27T02:00:00Z", ["Lots of ideas:", "▸ One", "▸ Two", "▸ Three", "▸ Four", "▸ I'm done for now"]);
    expect(latestTurnChips([t])).toEqual(["One", "Two", "Three"]);
  });

  it("returns no chips when the latest turn ended without a ▸ question", () => {
    const t = turn("2026-06-27T02:00:00Z", ["Here is your app.", "No options were offered."]);
    expect(latestTurnChips([t])).toEqual([]);
  });

  it("prefers the newest turn matching the given fsId over the globally-newest turn", () => {
    const newestOtherVersion = turn("2026-06-27T03:00:00Z", ["v2 turn", "▸ V2 chip"], [], "fs-v2");
    const targetVersion = turn("2026-06-27T02:00:00Z", ["v1 turn", "▸ V1 chip"], [], "fs-v1");
    expect(latestTurnChips([newestOtherVersion, targetVersion], "fs-v1")).toEqual(["V1 chip"]);
  });

  it("falls back to the newest turn when no turn matches the fsId", () => {
    const t = turn("2026-06-27T02:00:00Z", ["only turn", "▸ Only chip"], [], "fs-v1");
    expect(latestTurnChips([t], "fs-nonexistent")).toEqual(["Only chip"]);
  });

  it("ignores non-toplevel blocks when assembling the narration", () => {
    const t = turn("2026-06-27T02:00:00Z", ["Built it.", "▸ Make it blue"], [promptReq()]);
    expect(latestTurnChips([t])).toEqual(["Make it blue"]);
  });

  it("falls back to the next turn that has chips when the newest turn offered none", () => {
    // The newest turn is a code edit that ended without an interview tail (no
    // chips); the card should still light up from the next chip-bearing turn
    // rather than going empty.
    const newestNoChips = turn("2026-06-27T03:00:00Z", ["Refactored the grid.", "No options offered."]);
    const olderWithChips = turn("2026-06-27T02:00:00Z", ["Built it.", "▸ Add sound", "▸ Add a timer"]);
    expect(latestTurnChips([newestNoChips, olderWithChips])).toEqual(["Add sound", "Add a timer"]);
  });

  it("falls back past a chip-less pinned turn to an older turn at the same version", () => {
    // The pinned version's newest turn (e.g. a CLI seed: `File: /App.jsx`) has no
    // chips, but an older turn at the same fsId does — surface those.
    const seedNoChips = turn("2026-06-27T03:00:00Z", ["File: /App.jsx"], [], "fs-v1");
    const olderWithChips = turn("2026-06-27T02:00:00Z", ["Built it.", "▸ Add a high score"], [], "fs-v1");
    expect(latestTurnChips([seedNoChips, olderWithChips], "fs-v1")).toEqual(["Add a high score"]);
  });
});

describe("chipsFromNarration", () => {
  it("parses the trailing ▸ group, drops the terminal chip, and caps at three", () => {
    const text = ["Done!", "▸ One", "▸ Two", "▸ Three", "▸ Four", "▸ I'm done for now"].join("\n");
    expect(chipsFromNarration(text)).toEqual(["One", "Two", "Three"]);
  });

  it("returns no chips when the narration ended without a ▸ question", () => {
    expect(chipsFromNarration("Here is your app. No options offered.")).toEqual([]);
  });
});
