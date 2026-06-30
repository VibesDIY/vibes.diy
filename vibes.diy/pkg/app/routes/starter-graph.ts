import { normalizeTransform } from "@vibes.diy/api-types";

// The curated graph for the Instant Starter Stack on-ramp (#2941, #1896).
//
// The hand-tuned **spine**: a checked-in set of curated starter vibes and the
// curated cross-slug steps between them (the `FeaturedVibes` curation pattern).
// This is the single source of truth — the synthetic seed chats that surface a
// starter's curated chips are generated FROM these `chipLabel`s, and the
// `handleEditPrompt` pre-check matches a clicked chip against these edges.
//
// The `system` handle below is **illustrative** — it's just where the v1 Blooms
// happen to live. Nothing here (or in the lookup) gates on the owner handle; a
// curated vibe may be owned by any handle. Re-curating is a one-line edit + PR.

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

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  {
    category: "Music",
    label: "Music",
    blurb: "Play a grid of tones, then make it a sequencer, a drum machine, or a memory game.",
    entry: { ownerHandle: "system", appSlug: "bloom-root" },
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
];

/**
 * Resolve a clicked chip on `(ownerHandle, appSlug)` to its curated cross-slug
 * target, or `null` if the chip isn't a spine edge.
 *
 * **Slug-scoped (OQ-B, v1):** edges apply to the curated starter slug regardless
 * of which version is on screen, so the lookup needs no `fsId` — sidestepping the
 * "raw route param is undefined on the canonical `/vibe/<owner>/<slug>` URL" trap
 * (Codex #2950) entirely. A visitor's fork has a different owner/slug, so an edge
 * can only ever fire on the curated starter itself. The chip label is matched
 * through `normalizeTransform` — the SAME canonicalization the cache key and the
 * synthetic seed chats use — so casing/punctuation/`▸`-marker differences dedupe.
 */
export function curatedEdgeTarget(args: {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly chipLabel: string;
  /** Injectable for tests; defaults to the live graph. */
  readonly edges?: readonly CuratedEdge[];
}): StarterVibeRef | null {
  const wanted = normalizeTransform(args.chipLabel);
  const edges = args.edges ?? CURATED_EDGES;
  const hit = edges.find(
    (e) =>
      e.source.ownerHandle === args.ownerHandle && e.source.appSlug === args.appSlug && normalizeTransform(e.chipLabel) === wanted
  );
  return hit ? hit.target : null;
}

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
