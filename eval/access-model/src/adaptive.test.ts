import { describe, it, expect } from "vitest";
import { selectUnsaturated } from "./adaptive.js";

describe("selectUnsaturated", () => {
  it("returns prompts whose reps disagree and omits saturated ones", () => {
    const rows = [
      { id: "photo", grade: "PASS" },
      { id: "photo", grade: "PASS" }, // saturated → skip
      { id: "todo", grade: "FAIL" },
      { id: "todo", grade: "PASS" }, // disagree → top up
      { id: "shop", grade: "PASS" },
      { id: "shop", grade: "PASS" },
      { id: "shop", grade: "PASS" }, // saturated → skip
    ];
    expect(selectUnsaturated(rows)).toEqual(["todo"]);
  });

  it("treats a generate failure mixed with a grade as unsaturated", () => {
    const rows = [
      { id: "blog", grade: "PASS" },
      { id: "blog", grade: "GENERATE_FAILED" },
    ];
    expect(selectUnsaturated(rows)).toEqual(["blog"]);
  });

  it("returns [] when every prompt is saturated", () => {
    const rows = [
      { id: "a", grade: "PASS" },
      { id: "a", grade: "PASS" },
      { id: "b", grade: "FAIL" },
      { id: "b", grade: "FAIL" },
    ];
    expect(selectUnsaturated(rows)).toEqual([]);
  });

  it("returns ids sorted", () => {
    const rows = [
      { id: "zeta", grade: "PASS" },
      { id: "zeta", grade: "FAIL" },
      { id: "alpha", grade: "PASS" },
      { id: "alpha", grade: "SOFT" },
    ];
    expect(selectUnsaturated(rows)).toEqual(["alpha", "zeta"]);
  });
});
