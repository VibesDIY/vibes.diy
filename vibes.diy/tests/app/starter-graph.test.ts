import { describe, it, expect } from "vitest";
import {
  curatedEdgeTarget,
  starterVibeHref,
  starterSeedPlan,
  CURATED_EDGES,
  STARTER_CATEGORIES,
  type CuratedEdge,
} from "../../pkg/app/routes/starter-graph.js";

const edges: readonly CuratedEdge[] = [
  {
    source: { ownerHandle: "system", appSlug: "bloom-root" },
    chipLabel: "Add a pattern sequencer",
    target: { ownerHandle: "system", appSlug: "bloom-machine" },
  },
  {
    source: { ownerHandle: "system", appSlug: "bloom-root" },
    chipLabel: "Make it a memory game",
    target: { ownerHandle: "system", appSlug: "bloom-says" },
  },
];

describe("curatedEdgeTarget", () => {
  it("resolves a clicked chip to its curated cross-slug target", () => {
    expect(
      curatedEdgeTarget({ ownerHandle: "system", appSlug: "bloom-root", chipLabel: "Add a pattern sequencer", edges })
    ).toEqual({ ownerHandle: "system", appSlug: "bloom-machine" });
  });

  it("matches through normalizeTransform (casing, ▸ marker, trailing punctuation)", () => {
    // The seed chat may render "▸ Make it a memory game" with different casing/punct;
    // it must still resolve to the same edge.
    expect(
      curatedEdgeTarget({ ownerHandle: "system", appSlug: "bloom-root", chipLabel: "▸ Make it a MEMORY game!", edges })
    ).toEqual({ ownerHandle: "system", appSlug: "bloom-says" });
  });

  it("returns null when the chip isn't a curated edge (→ falls through to the existing dispatch)", () => {
    expect(curatedEdgeTarget({ ownerHandle: "system", appSlug: "bloom-root", chipLabel: "make it purple", edges })).toBeNull();
  });

  it("is slug-scoped: an edge only fires on its own source vibe, never a fork under another handle", () => {
    // Same chip label, different owner (a visitor's fork) → no edge.
    expect(
      curatedEdgeTarget({ ownerHandle: "casey", appSlug: "bloom-root", chipLabel: "Add a pattern sequencer", edges })
    ).toBeNull();
    // Same chip label, a different curated slug → no edge (the label belongs to bloom-root here).
    expect(
      curatedEdgeTarget({ ownerHandle: "system", appSlug: "bloom-machine", chipLabel: "Add a pattern sequencer", edges })
    ).toBeNull();
  });
});

describe("starterVibeHref", () => {
  it("builds the canonical /vibe URL with no version pin", () => {
    expect(starterVibeHref({ ownerHandle: "system", appSlug: "bloom-machine" })).toBe("/vibe/system/bloom-machine");
  });
});

describe("v1 Bloom graph (shipped content)", () => {
  it("wires the four existing Blooms: root → machine → drums, and root → says (the Game leaf)", () => {
    expect(curatedEdgeTarget({ ownerHandle: "system", appSlug: "bloom-root", chipLabel: "Add a pattern sequencer" })).toEqual({
      ownerHandle: "system",
      appSlug: "bloom-machine",
    });
    expect(curatedEdgeTarget({ ownerHandle: "system", appSlug: "bloom-machine", chipLabel: "Make it a drum machine" })).toEqual({
      ownerHandle: "system",
      appSlug: "bloom-drums",
    });
    expect(curatedEdgeTarget({ ownerHandle: "system", appSlug: "bloom-root", chipLabel: "Make it a memory game" })).toEqual({
      ownerHandle: "system",
      appSlug: "bloom-says",
    });
    expect(CURATED_EDGES).toHaveLength(3);
  });

  it("ships the Music category tile pointing at bloom-root", () => {
    const music = STARTER_CATEGORIES.find((c) => c.category === "Music");
    expect(music?.entry).toEqual({ ownerHandle: "system", appSlug: "bloom-root" });
  });

  it("starterSeedPlan groups edges into one seed per source vibe (the post-deploy plan)", () => {
    const plan = starterSeedPlan();
    // bloom-root has two outgoing edges; bloom-machine one; the leaves none.
    expect(plan).toEqual([
      { ownerHandle: "system", appSlug: "bloom-root", chips: ["Add a pattern sequencer", "Make it a memory game"] },
      { ownerHandle: "system", appSlug: "bloom-machine", chips: ["Make it a drum machine"] },
    ]);
  });
});
