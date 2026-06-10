import { describe, expect, it } from "vitest";
import { normalizeChannels } from "@vibes.diy/api-svc";

describe("normalizeChannels", () => {
  it("trims whitespace", () => {
    expect(normalizeChannels([" a ", "b\t"])).toEqual(["a", "b"]);
  });
  it("drops empty and whitespace-only entries", () => {
    expect(normalizeChannels(["", "   ", "x"])).toEqual(["x"]);
  });
  it("dedupes after trimming", () => {
    expect(normalizeChannels(["a", " a", "a "])).toEqual(["a"]);
  });
  it("returns [] for all-empty input", () => {
    expect(normalizeChannels(["", "  "])).toEqual([]);
  });
  it("returns [] for empty input", () => {
    expect(normalizeChannels([])).toEqual([]);
  });
});
