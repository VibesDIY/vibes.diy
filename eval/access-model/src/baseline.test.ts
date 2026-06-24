import { describe, it, expect } from "vitest";
import { mergeBaseline } from "./baseline.js";

describe("mergeBaseline", () => {
  it("keeps the recorded commit + rollups and refuses to overwrite without force", () => {
    const existing = { commit: "9cf43ea", eval: { metric: 0.4 }, holdout: { metric: 0.4 } };
    expect(() => mergeBaseline(existing, { commit: "abc", eval: { metric: 0.6 }, holdout: { metric: 0.5 } }, false)).toThrow(/baseline exists/);
    const forced = mergeBaseline(existing, { commit: "abc", eval: { metric: 0.6 }, holdout: { metric: 0.5 } }, true);
    expect(forced.commit).toBe("abc");
  });
});
