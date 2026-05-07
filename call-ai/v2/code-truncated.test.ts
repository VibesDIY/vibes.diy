import { describe, it, expect } from "vitest";
import {
  BlockStreamMsg,
  CodeMsg,
  CodeTruncatedMsg,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
  isCodeTruncated,
  type CodeTruncatedMsg as CodeTruncatedMsgType,
} from "./block-stream.js";

const baseTruncated: CodeTruncatedMsgType = {
  type: "block.code.truncated",
  blockId: "blk-1",
  streamId: "stream-1",
  seq: 7,
  blockNr: 2,
  timestamp: new Date(),
  sectionId: "sec-1",
  lang: "jsx",
  path: "/App.jsx",
  reason: "divider-as-end",
  kind: "fence-parse",
  truncatedAtLine: 12,
  errorCount: 1,
};

describe("isCodeTruncated", () => {
  it("accepts a well-formed message", () => {
    expect(isCodeTruncated(baseTruncated)).toBe(true);
  });

  it("rejects when each required field is missing", () => {
    const required: (keyof CodeTruncatedMsgType)[] = [
      "type",
      "blockId",
      "streamId",
      "seq",
      "blockNr",
      "timestamp",
      "sectionId",
      "lang",
      "reason",
      "kind",
      "truncatedAtLine",
      "errorCount",
    ];
    for (const k of required) {
      // Spread-and-omit to avoid a dynamically-computed delete (no-dynamic-delete).
      const entries = Object.entries(baseTruncated as Record<string, unknown>).filter(([key]) => key !== k);
      const broken = Object.fromEntries(entries);
      expect(isCodeTruncated(broken), `missing ${k} should reject`).toBe(false);
    }
  });

  it("path is optional — accepts a message without path", () => {
    const noPath = { ...baseTruncated };
    delete (noPath as Record<string, unknown>).path;
    expect(isCodeTruncated(noPath)).toBe(true);
  });

  it("filters by streamId", () => {
    expect(isCodeTruncated(baseTruncated, "stream-1")).toBe(true);
    expect(isCodeTruncated(baseTruncated, "other-stream")).toBe(false);
  });

  it("survives JSON round-trip — wire-safe", () => {
    const wire = JSON.parse(JSON.stringify(baseTruncated)) as unknown;
    expect(isCodeTruncated(wire)).toBe(true);
  });

  it("does NOT match a block.code.end (no false positive on the type field)", () => {
    const codeEnd = {
      ...baseTruncated,
      type: "block.code.end",
      stats: { lines: 12, bytes: 200 },
    };
    delete (codeEnd as Record<string, unknown>).reason;
    delete (codeEnd as Record<string, unknown>).kind;
    delete (codeEnd as Record<string, unknown>).truncatedAtLine;
    delete (codeEnd as Record<string, unknown>).errorCount;
    expect(isCodeEnd(codeEnd)).toBe(true);
    expect(isCodeTruncated(codeEnd)).toBe(false);
  });

  it("a code.begin is not matched", () => {
    const begin = {
      type: "block.code.begin",
      blockId: "blk-1",
      streamId: "stream-1",
      seq: 0,
      blockNr: 1,
      timestamp: new Date(),
      sectionId: "sec-1",
      lang: "jsx",
    };
    expect(isCodeBegin(begin)).toBe(true);
    expect(isCodeTruncated(begin)).toBe(false);
  });

  it("a code.line is not matched", () => {
    const line = {
      type: "block.code.line",
      blockId: "blk-1",
      streamId: "stream-1",
      seq: 1,
      blockNr: 1,
      timestamp: new Date(),
      sectionId: "sec-1",
      lang: "jsx",
      lineNr: 1,
      line: "const x = 1",
    };
    expect(isCodeLine(line)).toBe(true);
    expect(isCodeTruncated(line)).toBe(false);
  });
});

describe("union membership", () => {
  it("CodeTruncatedMsg validator accepts the canonical payload", () => {
    const r = CodeTruncatedMsg(baseTruncated);
    expect(r).toMatchObject({ type: "block.code.truncated", reason: "divider-as-end" });
  });

  it("CodeMsg union accepts a CodeTruncatedMsg (extending CodeMsg flows truncate through every consumer that already accepts CodeMsg)", () => {
    // arktype validators return the value when the input matches
    const r = CodeMsg(baseTruncated);
    expect(r).toMatchObject({ type: "block.code.truncated" });
  });

  it("BlockStreamMsg union accepts a CodeTruncatedMsg (inherited via CodeMsg, no direct extension needed)", () => {
    const r = BlockStreamMsg(baseTruncated);
    expect(r).toMatchObject({ type: "block.code.truncated" });
  });
});
