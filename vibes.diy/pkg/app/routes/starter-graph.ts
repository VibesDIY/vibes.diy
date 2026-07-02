// Curated on-ramp config for the Instant Starter Stack (#2941, #1896).
//
// **Setup-time config, not a runtime resolver.** The cross-slug routing now lives
// in the cached-suggestion BLESS map (a target-vibe bless record, #2941) and is
// resolved server-side by `getCachedSuggestion` — exactly like a same-slug stay.
// So at runtime nothing here decides where a chip goes. This module is two things:
//
//   1. `STARTER_CATEGORIES` — the `/start` category tiles (genre → entry vibe).
//   2. `CURATED_EDGES` — the hand-tuned tree, the single source the POST-DEPLOY
//      setup reads to (a) seed each source's curated chip labels into its
//      narration (`seedStarterChips`) and (b) bless each `chipLabel → targetVibe`
//      cross-slug link into the source's bless map. `starterSeedPlan` derives (a).
//
// The `system` handle below is **illustrative** — just where the v1 Blooms live.
// Nothing gates on the owner handle; a curated vibe may be owned by any handle.

export interface StarterVibeRef {
  readonly ownerHandle: string;
  readonly appSlug: string;
}

/** A `/start` category tile: the door into a genre's curated tree. */
export interface StarterCategory {
  readonly category: string;
  /** Tile label (may differ from the category key). */
  readonly label: string;
  /** A one-line "what is this" for the tile. */
  readonly blurb: string;
  /** The vibe the tile opens into — a live, running curated app. */
  readonly entry: StarterVibeRef;
}

/**
 * One curated spine edge: clicking `chipLabel` on `source` jumps to `target`.
 * `target` is a different curated public vibe (a new namespace, which is
 * appropriate for the on-ramp) — an instant public read, no login/codegen/fork.
 */
export interface CuratedEdge {
  readonly source: StarterVibeRef;
  readonly chipLabel: string;
  readonly target: StarterVibeRef;
}

// ── v1 content: Music / the Blooms (the four existing hand-tuned vibes) ──────
// bloom-root ─"Add a pattern sequencer"→ bloom-machine ─"Make it a drum machine"→ bloom-drums
//            └"Make it a memory game"──→ bloom-says   (a Game — categories are doors, not fences)
//
// ── v1.1 content: the matching-games branch (rooted under bloom-says) ─────────
// bloom-says ─"Make it a matching game"→ match-pairs
//   match-pairs ─"Make the pairs play tones"────→ tone-pairs  ·leaf (sonic evolution)
//               └"Hunt the color word instead"──→ hue-hunt ─"Let me play unlimited rounds"→ hue-rush ·leaf
// (match-pairs/hue-hunt adapted from jchris/memory-pairs + jchris/hue-hunt;
//  tone-pairs/hue-rush are their hand-tuned evolutions. Sources: vibes/<slug>/.
//  The branch hangs off the Music tree's game leaf — not a /start tile — so the
//  deep games live one hop past bloom-says, and the Games tile stays free for
//  the word-games lane.)

// ── v1.2 content: Games / word games ──────────────────────────────────────────
// word-jumble ─"Grow it into a spelling hive"→ jchris/spelling-hive  ·leaf
// (word-jumble is the touch-first unscramble entry; spelling-hive is the full
//  7-letter comb — real ENABLE word lists, public top-50 leaderboard, backend
//  daily prune. A cross-OWNER curated link: the target just has to be public.)

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  {
    category: "Music",
    label: "Music",
    blurb: "Play a grid of tones, then make it a sequencer, a drum machine, or a memory game.",
    entry: { ownerHandle: "system", appSlug: "bloom-root" },
  },
  {
    category: "Games",
    label: "Games",
    blurb: "Untangle a word from six letters, then grow it into a spelling hive with scores to beat.",
    entry: { ownerHandle: "system", appSlug: "word-jumble" },
  },
];

export const CURATED_EDGES: readonly CuratedEdge[] = [
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
  {
    source: { ownerHandle: "system", appSlug: "bloom-says" },
    chipLabel: "Make it a matching game",
    target: { ownerHandle: "system", appSlug: "match-pairs" },
  },
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
  {
    source: { ownerHandle: "system", appSlug: "word-jumble" },
    chipLabel: "Grow it into a spelling hive",
    target: { ownerHandle: "jchris", appSlug: "spelling-hive" },
  },
];

/** The canonical `/vibe` URL for a curated starter vibe (no version pin). */
export function starterVibeHref(ref: StarterVibeRef): string {
  return `/vibe/${ref.ownerHandle}/${ref.appSlug}`;
}

/** One starter vibe's seed: the chips to surface on it (its outgoing edges). */
export interface StarterSeed {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly chips: readonly string[];
}

/**
 * Group the curated edges into one {@link StarterSeed} per source vibe — the plan
 * the operator runs (one `seedStarterChips` call each) to set up the on-ramp tree
 * after deploy. The chips are exactly each source's outgoing edge labels, so the
 * seeded chips, the rendered chips, and the navigable edges are all the same list
 * (one source of truth: this graph). For v1: `bloom-root` → 2 chips,
 * `bloom-machine` → 1 chip (the leaves have no outgoing edges, so no seed).
 */
export function starterSeedPlan(edges: readonly CuratedEdge[] = CURATED_EDGES): readonly StarterSeed[] {
  const bySource = new Map<string, { ownerHandle: string; appSlug: string; chips: string[] }>();
  for (const e of edges) {
    const key = `${e.source.ownerHandle}/${e.source.appSlug}`;
    let seed = bySource.get(key);
    if (!seed) {
      seed = { ownerHandle: e.source.ownerHandle, appSlug: e.source.appSlug, chips: [] };
      bySource.set(key, seed);
    }
    seed.chips.push(e.chipLabel);
  }
  return [...bySource.values()];
}
