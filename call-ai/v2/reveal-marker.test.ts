import { describe, it, expect } from "vitest";
import { CodeBeginMsg } from "./block-stream.js";
import { type } from "arktype";

const base = {
  type: "block.code.begin",
  sectionId: "s1",
  lang: "jsx",
  blockId: "b1",
  streamId: "p1",
  seq: 0,
  blockNr: 0,
  timestamp: new Date(),
};

describe("CodeBeginMsg.reveal", () => {
  it("accepts a code.begin WITH reveal: 'typewriter'", () => {
    const r = CodeBeginMsg({ ...base, reveal: "typewriter" });
    expect(r instanceof type.errors).toBe(false);
  });

  it("accepts a code.begin WITHOUT reveal (backward compatible)", () => {
    const r = CodeBeginMsg({ ...base });
    expect(r instanceof type.errors).toBe(false);
  });

  it("rejects an unknown reveal value", () => {
    const r = CodeBeginMsg({ ...base, reveal: "sparkle" });
    expect(r instanceof type.errors).toBe(true);
  });
});
