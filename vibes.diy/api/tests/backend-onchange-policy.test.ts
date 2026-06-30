// Slice B5 (#2856): pure loop-guard policy for the backend.js onChange lane.

import { describe, expect, it } from "vitest";
import { onChangeEmitDecision, MAX_ONCHANGE_DEPTH } from "@vibes.diy/api-svc/intern/backend-onchange-policy.js";

describe("onChangeEmitDecision (#2856 B5)", () => {
  it("a frontend write (origin depth 0) emits at depth 1", () => {
    expect(onChangeEmitDecision(0)).toEqual({ emit: true, depth: 1 });
  });

  it("a backend write below the cap emits the next generation", () => {
    expect(onChangeEmitDecision(1)).toEqual({ emit: true, depth: 2 });
    expect(onChangeEmitDecision(MAX_ONCHANGE_DEPTH - 1)).toEqual({ emit: true, depth: MAX_ONCHANGE_DEPTH });
  });

  it("suppresses emission once the source write is at the cap (chain terminates)", () => {
    expect(onChangeEmitDecision(MAX_ONCHANGE_DEPTH)).toEqual({ emit: false, depth: MAX_ONCHANGE_DEPTH });
    expect(onChangeEmitDecision(MAX_ONCHANGE_DEPTH + 1).emit).toBe(false);
  });

  it("a self-feeding chain terminates in a bounded number of generations", () => {
    // Simulate handler-induced writes feeding onChange feeding writes…
    let depth = 0; // first user write
    const generations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const d = onChangeEmitDecision(depth);
      if (!d.emit) break;
      generations.push(d.depth);
      depth = d.depth; // the handler's write is tagged with the message's depth
    }
    expect(generations).toEqual([1, 2, 3, 4]);
    expect(generations.length).toBe(MAX_ONCHANGE_DEPTH);
  });
});
