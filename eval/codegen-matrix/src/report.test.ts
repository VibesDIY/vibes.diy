import { describe, it, expect } from "vitest";
import { median, buildRows, renderSummary, type JoinedCell } from "./report.js";

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("buildRows", () => {
  const cells: JoinedCell[] = [
    {
      promptId: "todo",
      model: "m1",
      class: "c",
      tier: "cheap",
      rep: 0,
      latencyMs: 1000,
      exitState: "ok",
      attempts: 1,
      rubricRatio: 1,
      featureScore: 5,
      designScore: 4,
    },
    {
      promptId: "todo",
      model: "m1",
      class: "c",
      tier: "cheap",
      rep: 1,
      latencyMs: 3000,
      exitState: "ok",
      attempts: 1,
      rubricRatio: 0.8,
      featureScore: 4,
      designScore: 4,
    },
    {
      promptId: "todo",
      model: "m2",
      class: "c",
      tier: "expensive",
      rep: 0,
      latencyMs: 5000,
      exitState: "generate-failed",
      attempts: 3,
      rubricRatio: null,
      featureScore: null,
      designScore: null,
    },
  ];

  it("aggregates reps per (model, prompt)", () => {
    const rows = buildRows(cells);
    const m1 = rows.find((r) => r.model === "m1" && r.promptId === "todo");
    expect(m1?.medianLatencyMs).toBe(2000);
    expect(m1?.meanRubric).toBeCloseTo(0.9);
  });

  it("keeps a failed cell visible with null metrics", () => {
    const rows = buildRows(cells);
    const m2 = rows.find((r) => r.model === "m2");
    expect(m2?.medianLatencyMs).toBe(5000);
    expect(m2?.meanFeature).toBeNull();
  });
});

describe("renderSummary", () => {
  it("emits a markdown table with a header", () => {
    const md = renderSummary(
      buildRows([
        {
          promptId: "todo",
          model: "m1",
          class: "c",
          tier: "cheap",
          rep: 0,
          latencyMs: 1000,
          exitState: "ok",
          rubricRatio: 1,
          featureScore: 5,
          designScore: 4,
        },
      ])
    );
    expect(md).toContain("| model |");
    expect(md).toContain("m1");
  });
});
