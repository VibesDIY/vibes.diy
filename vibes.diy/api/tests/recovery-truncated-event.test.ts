import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildTruncatedEvent, createBlockAccumulator, createStreamingResolver, type ApplyErrorEvent } from "@vibes.diy/api-svc";
import {
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isCodeTruncated,
  type CodeBeginMsg,
  type CodeEndMsg,
  type CodeLineMsg,
  type CodeTruncatedMsg,
} from "@vibes.diy/call-ai-v2";

const ts = new Date("2026-05-04T00:00:00Z");

interface BuiltBlock {
  readonly begin: CodeBeginMsg;
  readonly lines: readonly CodeLineMsg[];
  readonly end: CodeEndMsg;
}

function makeBlock(blockId: string, sectionId: string, lines: readonly string[], path = "App.jsx"): BuiltBlock {
  return {
    begin: {
      type: "block.code.begin",
      blockId,
      blockNr: 1,
      streamId: "stream",
      seq: 1,
      timestamp: ts,
      sectionId,
      lang: "jsx",
      path,
    },
    lines: lines.map((line, i) => ({
      type: "block.code.line",
      blockId,
      blockNr: 1,
      streamId: "stream",
      seq: 2,
      timestamp: ts,
      sectionId,
      lang: "jsx",
      path,
      line,
      lineNr: i + 1,
    })),
    end: {
      type: "block.code.end",
      blockId,
      blockNr: 1,
      streamId: "stream",
      seq: 3,
      timestamp: ts,
      sectionId,
      lang: "jsx",
      path,
      stats: { lines: lines.length, bytes: lines.join("\n").length },
    },
  };
}

const FIX_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/recovery-streams");

function loadFixture(name: string): readonly unknown[] {
  const raw = readFileSync(resolve(FIX_DIR, name), "utf8");
  return raw
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

describe("buildTruncatedEvent — pure helper", () => {
  const closed = makeBlock("blk-X", "sec-X", ["<<<<<<< SEARCH", "no-match", "=======", "rep", ">>>>>>> REPLACE"]);

  it("constructs the wire shape with the first error's reason and the given errorCount", () => {
    const evt = buildTruncatedEvent({
      closed,
      firstError: { reason: "divider-as-end", kind: "fence-parse" },
      errorCount: 1,
      promptId: "stream",
      blockSeq: 99,
      now: ts,
    });
    expect(isCodeTruncated(evt)).toBe(true);
    expect(evt).toMatchObject({
      type: "block.code.truncated",
      blockId: "blk-X",
      sectionId: "sec-X",
      streamId: "stream",
      seq: 99,
      blockNr: 1,
      lang: "jsx",
      path: "App.jsx",
      reason: "divider-as-end",
      kind: "fence-parse",
      truncatedAtLine: 5,
      errorCount: 1,
    });
    expect(evt.timestamp).toBe(ts);
  });

  it("propagates errorCount independently of firstError — divider-as-end + orphan-end shows up as count=2", () => {
    const evt = buildTruncatedEvent({
      closed,
      firstError: { reason: "divider-as-end", kind: "fence-parse" },
      errorCount: 2,
      promptId: "stream",
      blockSeq: 5,
      now: ts,
    });
    expect(evt.reason).toBe("divider-as-end");
    expect(evt.errorCount).toBe(2);
  });

  it("omits path when the begin had no path", () => {
    const noPath = makeBlock("blk-Y", "sec-Y", ["<<<<<<< SEARCH", "x", "=======", "y", ">>>>>>> REPLACE"]);
    const beginNoPath: CodeBeginMsg = { ...noPath.begin };
    delete (beginNoPath as { path?: string }).path;
    const evt = buildTruncatedEvent({
      closed: { ...noPath, begin: beginNoPath },
      firstError: { reason: "orphan-end", kind: "fence-parse" },
      errorCount: 1,
      promptId: "stream",
      blockSeq: 1,
      now: ts,
    });
    expect("path" in evt).toBe(false);
    expect(isCodeTruncated(evt)).toBe(true);
  });

  it("survives JSON round-trip (wire-safe)", () => {
    const evt = buildTruncatedEvent({
      closed,
      firstError: { reason: "divider-as-end", kind: "fence-parse" },
      errorCount: 1,
      promptId: "stream",
      blockSeq: 0,
      now: ts,
    });
    const wire = JSON.parse(JSON.stringify(evt));
    expect(isCodeTruncated(wire)).toBe(true);
  });
});

describe("captured fixtures — orchestrator emit decision end-to-end", () => {
  // Each fixture is the real wire stream a recovery-able run produced, trimmed
  // through the failed block.code.end. Replaying through createStreamingResolver
  // (which the orchestrator uses) and createBlockAccumulator (ditto) tells us
  // whether buildTruncatedEvent would fire for the right block, and confirms
  // clean code.ends are forwarded normally.
  interface ReplayResult {
    readonly truncateEvents: readonly CodeTruncatedMsg[];
    readonly forwardedEnds: readonly CodeEndMsg[];
    readonly applyErrors: readonly ApplyErrorEvent[];
  }
  function replayThrough(events: readonly unknown[]): ReplayResult {
    const applyErrors: ApplyErrorEvent[] = [];
    const resolver = createStreamingResolver({
      chatId: "test-chat",
      promptId: "test-prompt",
      seed: new Map(),
      onApplyError: (e) => applyErrors.push(e),
    });
    const acc = createBlockAccumulator();
    const truncateEvents: CodeTruncatedMsg[] = [];
    const forwardedEnds: CodeEndMsg[] = [];
    let blockSeq = 0;
    for (const value of events) {
      switch (true) {
        case isCodeBegin(value):
        case isCodeLine(value):
          acc.ingest(value);
          break;
        case isCodeEnd(value): {
          const closed = acc.ingest(value);
          if (closed === undefined) break;
          const r = resolver.observeBlock(closed);
          if (r.errors.length > 0) {
            // Mirror the orchestrator: suppress this code.end, emit truncate
            truncateEvents.push(
              buildTruncatedEvent({
                closed,
                firstError: r.errors[0],
                errorCount: r.errors.length,
                promptId: "test-prompt",
                blockSeq,
                now: ts,
              })
            );
          } else {
            forwardedEnds.push(value);
          }
          blockSeq += 1;
          break;
        }
      }
    }
    return { truncateEvents, forwardedEnds, applyErrors };
  }

  it("kanban-priority fixture: clean block A's code.end is forwarded; failed block B emits exactly one truncate (errorCount >= 2)", () => {
    const events = loadFixture("kanban-priority-divider-as-end.jsonl");
    const { truncateEvents, forwardedEnds } = replayThrough(events);

    expect(forwardedEnds).toHaveLength(1);
    expect(forwardedEnds[0].sectionId).toBe("z4Dpa19c4jys4WAqbX");

    expect(truncateEvents).toHaveLength(1);
    expect(truncateEvents[0]).toMatchObject({
      type: "block.code.truncated",
      sectionId: "z2EetbmGUgcvJGXWvW",
      blockId: "zYWhk3nheQLZgcqU1",
      reason: "divider-as-end",
    });
    expect(truncateEvents[0].errorCount).toBeGreaterThanOrEqual(2);
    expect(truncateEvents[0].truncatedAtLine).toBeGreaterThan(0);
  });

  it("task-tracker fixture: only the failing block emits truncate; the prior clean block's code.end is forwarded normally", () => {
    const events = loadFixture("task-tracker-clean-then-fail.jsonl");
    const { truncateEvents, forwardedEnds } = replayThrough(events);

    // Two code.end events in the fixture — the clean one (zP7mJPsMU6oegMmkN) is forwarded;
    // the failing one (z51dXuW9k7tV3meu9x) is suppressed and replaced with a truncate.
    expect(forwardedEnds).toHaveLength(1);
    expect(forwardedEnds[0].sectionId).toBe("zP7mJPsMU6oegMmkN");

    expect(truncateEvents).toHaveLength(1);
    expect(truncateEvents[0].sectionId).toBe("z51dXuW9k7tV3meu9x");
    expect(truncateEvents[0].reason).toBe("divider-as-end");
    expect(truncateEvents[0].errorCount).toBeGreaterThanOrEqual(2);
  });

  it("the failed block's code.end is NEVER among forwarded ends — suppression is total", () => {
    const events = loadFixture("kanban-priority-divider-as-end.jsonl");
    const { forwardedEnds, truncateEvents } = replayThrough(events);
    const truncatedSectionId = truncateEvents[0].sectionId;
    const truncatedBlockId = truncateEvents[0].blockId;
    for (const fe of forwardedEnds) {
      expect(fe.sectionId).not.toBe(truncatedSectionId);
      expect(fe.blockId === truncatedBlockId && fe.sectionId === truncatedSectionId).toBe(false);
    }
  });
});
