import { describe, it, expect } from "vitest";
import { median, buildRows, renderSummary, buildStructureRows, renderStructure, type JoinedCell } from "./report.js";
import type { StructureSignals } from "./structure.js";

const ZERO_STRUCT: StructureSignals = {
  hasAccessJs: false,
  accessInAppJsx: false,
  usesUseVibe: false,
  gatesOnCan: false,
  usesUseViewer: false,
  usesRequireAccess: false,
  usesRequireRole: false,
  perObjectChannel: false,
  usesFireproof: false,
  usesCallAi: false,
  usesCallAiSchema: false,
};

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

describe("buildStructureRows", () => {
  const cells: JoinedCell[] = [
    {
      promptId: "collab",
      model: "m1",
      class: "c",
      tier: "cheap",
      rep: 0,
      latencyMs: 1,
      exitState: "ok",
      attempts: 1,
      rubricRatio: 1,
      featureScore: 4,
      designScore: 3,
      hadNoFilesAttempt: false,
      structure: { ...ZERO_STRUCT, hasAccessJs: true, usesRequireAccess: true, gatesOnCan: true },
    },
    {
      promptId: "collab",
      model: "m1",
      class: "c",
      tier: "cheap",
      rep: 1,
      latencyMs: 1,
      exitState: "ok",
      attempts: 1,
      rubricRatio: 1,
      featureScore: 1,
      designScore: 1,
      hadNoFilesAttempt: false,
      structure: { ...ZERO_STRUCT, hasAccessJs: false },
    },
    {
      promptId: "collab",
      model: "m1",
      class: "c",
      tier: "cheap",
      rep: 2,
      latencyMs: 1,
      exitState: "generate-failed",
      attempts: 3,
      rubricRatio: null,
      featureScore: null,
      designScore: null,
      hadNoFilesAttempt: true,
      structure: null,
    },
  ];

  it("computes parse-fail over all cells and protocol rates over ok cells", () => {
    const [r] = buildStructureRows(cells);
    expect(r.total).toBe(3);
    expect(r.ok).toBe(2);
    expect(r.parseFailRate).toBeCloseTo(1 / 3); // 1 of 3 cells had a no-files attempt
    expect(r.accessJsRate).toBeCloseTo(0.5); // 1 of 2 ok cells emitted access.js
    expect(r.dslRate).toBeCloseTo(0.5);
    expect(r.canGateRate).toBeCloseTo(0.5);
  });

  it("renders a markdown table with the structural header", () => {
    const md = renderStructure(buildStructureRows(cells));
    expect(md).toContain("Structural signals (per model)");
    expect(md).toContain("parse-fail");
    expect(md).toContain("m1");
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
          attempts: 1,
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
