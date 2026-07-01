import { describe, it, expect } from "vitest";
import { starterVibeHref, starterSeedPlan, CURATED_EDGES, STARTER_CATEGORIES } from "../../pkg/app/routes/starter-graph.js";

// `starter-graph.ts` is SETUP config now (#2941): the cross-slug routing lives in
// the cached-suggestion bless map at runtime, not here. These tests pin the
// checked-in content the post-deploy setup reads (the /start tiles + the edges
// that drive seed + bless) and the seed-plan derivation.

describe("starterVibeHref", () => {
  it("builds the canonical /vibe URL with no version pin", () => {
    expect(starterVibeHref({ ownerHandle: "system", appSlug: "bloom-machine" })).toBe("/vibe/system/bloom-machine");
  });
});

describe("v1 Bloom graph (shipped content)", () => {
  it("wires the four existing Blooms: root → machine → drums, and root → says (the Game leaf)", () => {
    expect(CURATED_EDGES.filter((e) => e.source.appSlug.startsWith("bloom"))).toEqual([
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
      {
        source: { ownerHandle: "system", appSlug: "bloom-machine" },
        chipLabel: "Make it a drum machine",
        target: { ownerHandle: "system", appSlug: "bloom-drums" },
      },
    ]);
  });

  it("ships the Music category tile pointing at bloom-root", () => {
    const music = STARTER_CATEGORIES.find((c) => c.category === "Music");
    expect(music?.entry).toEqual({ ownerHandle: "system", appSlug: "bloom-root" });
  });
});

describe("v1.1 Games graph (shipped content)", () => {
  it("wires the games: match-pairs → tone-pairs, and match-pairs → hue-hunt → hue-rush", () => {
    expect(CURATED_EDGES.filter((e) => !e.source.appSlug.startsWith("bloom"))).toEqual([
      {
        source: { ownerHandle: "system", appSlug: "match-pairs" },
        chipLabel: "Make the pairs play tones",
        target: { ownerHandle: "system", appSlug: "tone-pairs" },
      },
      {
        source: { ownerHandle: "system", appSlug: "match-pairs" },
        chipLabel: "Hunt the color word instead",
        target: { ownerHandle: "system", appSlug: "hue-hunt" },
      },
      {
        source: { ownerHandle: "system", appSlug: "hue-hunt" },
        chipLabel: "Let me play unlimited rounds",
        target: { ownerHandle: "system", appSlug: "hue-rush" },
      },
    ]);
  });

  it("ships the Games category tile pointing at match-pairs", () => {
    const games = STARTER_CATEGORIES.find((c) => c.category === "Games");
    expect(games?.entry).toEqual({ ownerHandle: "system", appSlug: "match-pairs" });
  });
});

describe("starterSeedPlan", () => {
  it("groups edges into one seed per source vibe — the chip labels the setup seeds", () => {
    expect(starterSeedPlan()).toEqual([
      { ownerHandle: "system", appSlug: "bloom-root", chips: ["Add a pattern sequencer", "Make it a memory game"] },
      { ownerHandle: "system", appSlug: "bloom-machine", chips: ["Make it a drum machine"] },
      { ownerHandle: "system", appSlug: "match-pairs", chips: ["Make the pairs play tones", "Hunt the color word instead"] },
      { ownerHandle: "system", appSlug: "hue-hunt", chips: ["Let me play unlimited rounds"] },
    ]);
  });
});
