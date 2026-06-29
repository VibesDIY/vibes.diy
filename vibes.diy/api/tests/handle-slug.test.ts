import { describe, it, expect } from "vitest";
import { toRFC2822_32ByteLength } from "@vibes.diy/vibe-types";

// The handle/app-slug sanitizer is the single source of truth shared by the
// server write path (api-svc) and the handle-picker preview (base). The picker
// submits an already-sanitized slug and the server sanitizes again on write, so
// the function MUST be idempotent or the persisted handle drifts from the inline
// preview at the 32-char truncation edge (VibesDIY/vibes.diy#2825).
describe("toRFC2822_32ByteLength", () => {
  it("lowercases, maps unsupported chars to dashes, collapses runs, trims edges", () => {
    expect(toRFC2822_32ByteLength("My Cool Handle!")).toBe("my-cool-handle");
    expect(toRFC2822_32ByteLength("--A__b--")).toBe("a-b");
  });

  it("caps length at 32 bytes", () => {
    expect(toRFC2822_32ByteLength("a".repeat(40)).length).toBe(32);
  });

  it("is idempotent at the truncation edge (slice before the trailing-dash trim)", () => {
    // 31 letters then `!b` → `…a-b` (33 chars). A naive trim-then-slice would
    // leave `…a-` and the next pass would strip the dash → drift.
    const raw = "a".repeat(31) + "!b";
    const once = toRFC2822_32ByteLength(raw);
    expect(once).toBe("a".repeat(31));
    expect(once.endsWith("-")).toBe(false);
    expect(toRFC2822_32ByteLength(once)).toBe(once);
  });

  it("is a fixed point for any already-sanitized value", () => {
    for (const s of ["my-handle", "ziggy", "a".repeat(32), "a1-b2-c3"]) {
      expect(toRFC2822_32ByteLength(s)).toBe(s);
    }
  });
});
