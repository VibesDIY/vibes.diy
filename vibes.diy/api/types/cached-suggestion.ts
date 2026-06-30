/**
 * Cached suggestion-chip results — the READ half of the chip model (#2801).
 * Browser-safe and pure (only a type-only intra-package import, which erases at
 * runtime).
 *
 * A suggestion chip is a *transform* of the vibe you're on. Its result is real
 * codegen and costs tokens — "if tokens were free we'd precompute every chip"
 * (jchris). So we cache: the precomputed result of `(source-version, transform)`
 * is staged as **a new fsId under the source vibe's own `(ownerHandle, appSlug)`**
 * — same owner, same slug, a new code version (§2: same slug + new fsId = new
 * code, data carried). It is **never published except by the owner**: precompute
 * stages versions, it never advances the public HEAD; the owner publishes if/when
 * they want. A chip whose `(source, transform)` already has a staged version is
 * therefore an O(1) **read** (navigate to that version — no codegen); everything
 * else is a write.
 *
 * This module is that decision's pure core:
 *
 *  1. {@link cachedSuggestionKey} — the content-address dedupe key
 *     `(source, transform[, model])`. The SAME transform of the SAME source
 *     version maps to the SAME staged result instead of regenerating. It is the
 *     key the precache index is keyed on / the tag a staged version carries —
 *     NOT a slug or owner (the result keeps the source's slug).
 *  2. {@link resolveCachedRead} — the read/write decision, made BEFORE anything
 *     commits, by an injected lookup that returns the staged version (or null).
 *     A hit is a read (navigate to `/vibe/<owner>/<slug>/<fsId>`); a miss or ANY
 *     lookup error soft-fails to the write lane (writes keep fail-loud semantics).
 *     The decision is identity-free: it depends only on whether the result exists,
 *     never on who clicks. Identity matters only in the write lane it falls
 *     through to (owner edits in place, non-owner forks).
 *
 * Design source: notes/2026-06-26-agent-in-vibe-ux-epic.md §1a/§2/§8 and
 * docs/superpowers/specs/2026-06-28-cached-fork-infra-design.md.
 */

import { type } from "arktype";
import type { ResGetAppByFsId } from "./app.js";

/** The grant union `getAppByFsId` returns for a viewer on an app. */
type AppGrant = ResGetAppByFsId["grant"];

// ─────────────────────────────────────────────────────────────────────────────
// Storage shape — a cached suggestion result is staged as a new fsId under the
// SOURCE vibe's own (ownerHandle, appSlug) and recorded in that app's
// `AppSettings` JSON (no new table). The record is an `active.cached-suggestion`
// ActiveEntry, one per cached chip, composing (dbAcls-style) into the keyed map
// `entry.cachedSuggestions: { [cacheKey]: { fsId, sourceFsId } }`. (#2801, #2890)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The map value for one cached suggestion: the staged result version (`fsId`)
 * and the SOURCE version it was derived from (`sourceFsId`). `sourceFsId` is
 * REQUIRED (Charlie #2890) — the serve path verifies that source version was
 * publicly readable before serving the staged result anonymously, which is what
 * keeps the PII boundary intact (a cached read must be a transform of
 * already-public source code, never an owner's unpublished draft — Codex P1).
 */
export const cachedSuggestionRecord = type({
  fsId: "string",
  sourceFsId: "string",
});
export type CachedSuggestionRecord = typeof cachedSuggestionRecord.infer;

/** ActiveEntry variant — one row per content-address `key` inside AppSettings. */
export const ActiveCachedSuggestion = type({
  type: "'active.cached-suggestion'",
  /** The content-address key from {@link cachedSuggestionKey}. */
  key: "string",
  /** The staged result version. */
  fsId: "string",
  /** The public-HEAD source version the result was derived from. */
  sourceFsId: "string",
});
export type ActiveCachedSuggestion = typeof ActiveCachedSuggestion.infer;
export function isActiveCachedSuggestion(obj: unknown): obj is ActiveCachedSuggestion {
  return !(ActiveCachedSuggestion(obj) instanceof type.errors);
}

// ─────────────────────────────────────────────────────────────────────────────
// The BLESS half (#2801 follow-up) — the serve-eligibility layer.
//
// `active.cached-suggestion` above records what an owner *produced* (a generated
// result, deny-by-default). It does NOT make the result servable to visitors. An
// owner must additionally **bless** a specific produced result before it becomes
// a fast-path in-namespace "stay"; everything unblessed forks. Blessing is an
// explicit owner action (the write is owner-gated in `ensureAppSettings`) recorded
// over the exact `{key, fsId, sourceFsId}` tuple (Charlie #2890), independently
// revocable. The serve path (reader + grant) reads ONLY the bless map: not-blessed
// or revoked ⇒ absent ⇒ fork (fail-to-fork). `approvedBy`/`approvedAt` are the
// audit trail (and the forward hook for admin-on-behalf blessing later).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The map value for one blessed suggestion: the same `{fsId, sourceFsId}` the
 * grant verifies (source-was-public) plus who blessed it and when. `approvedBy`
 * is the blessing owner's userId today; it is the seam for a future
 * admin-on-behalf approver without a schema change.
 */
export const cachedSuggestionBlessRecord = type({
  fsId: "string",
  sourceFsId: "string",
  approvedBy: "string",
  approvedAt: "string",
});
export type CachedSuggestionBlessRecord = typeof cachedSuggestionBlessRecord.infer;

/** ActiveEntry variant — one bless row per content-address `key` inside AppSettings. */
export const ActiveCachedSuggestionBless = type({
  type: "'active.cached-suggestion-bless'",
  /** The content-address key from {@link cachedSuggestionKey}. */
  key: "string",
  /** The staged result version this bless vouches for (must match the produced entry). */
  fsId: "string",
  /** The public-HEAD source version the result was derived from. */
  sourceFsId: "string",
  /** The owner userId that blessed this result (audit + future admin-on-behalf seam). */
  approvedBy: "string",
  /** ISO timestamp of the bless. */
  approvedAt: "string",
});
export type ActiveCachedSuggestionBless = typeof ActiveCachedSuggestionBless.infer;
export function isActiveCachedSuggestionBless(obj: unknown): obj is ActiveCachedSuggestionBless {
  return !(ActiveCachedSuggestionBless(obj) instanceof type.errors);
}

/** The vibe version a transform is applied to (its precomputed result is keyed off this). */
export interface CachedSuggestionSource {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** The code version the transform applies to. Omit to key on the slug alone
   *  (e.g. a starter whose "latest" is implied). */
  readonly fsId?: string;
}

export interface CachedSuggestionKeyInput {
  readonly source: CachedSuggestionSource;
  /** The chip prompt / typed edit whose precomputed result we're addressing. */
  readonly transform: string;
  /** Codegen model+version, folded into the key so the same English transform
   *  under a different model addresses a DIFFERENT result. Optional — omit for
   *  model-agnostic dedupe. */
  readonly model?: string;
}

/**
 * Canonicalize a chip prompt / typed edit so trivially-different strings dedupe
 * to one cached result (resolves OQ#2). Strips a leading `▸` chip marker,
 * lowercases, collapses internal whitespace, trims, and drops trailing sentence
 * punctuation. Model/version is folded in separately by {@link cachedSuggestionKey}'s
 * `model` field, NOT here — normalization is about the natural-language transform
 * only.
 */
export function normalizeTransform(transform: string): string {
  return transform
    .replace(/^\s*▸\s*/u, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.!?…]+$/u, "")
    .trim();
}

// FNV-1a (32-bit) — a small, fast, dependency-free, deterministic string hash.
// Math.imul keeps the multiply in 32-bit space across engines.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Two differently-seeded 32-bit hashes concatenated in base36 (~13 chars, ~64
// bits) keep accidental collisions across the whole cache space negligible while
// staying compact (a tag, not a slug — but kept ≤32 chars regardless).
function hashToBase36(input: string): string {
  const a = fnv1a(input).toString(36);
  // A visible salt decorrelates the second hash from the first, so the combined
  // key spans ~64 bits rather than one 32-bit hash repeated.
  const b = fnv1a(`cf-salt:${input}`).toString(36);
  return `${a}-${b}`;
}

/**
 * The content-address dedupe key for `(source, transform[, model])`. Deterministic
 * (`[a-z0-9-]`, ≤32 chars): identical inputs always produce the same key, so the
 * precache index resolves a staged version by an O(1) key lookup instead of
 * regenerating. This is a *key* — the tag a staged version carries / the index
 * key — NOT a slug or owner; the staged result keeps the SOURCE's slug. Fields
 * are joined with a newline (which normalizeTransform strips and a handle/slug
 * can't contain) so distinct inputs can't alias by concatenation.
 */
export function cachedSuggestionKey(input: CachedSuggestionKeyInput): string {
  const { source, transform, model } = input;
  const canonical = [
    source.ownerHandle.toLowerCase(),
    source.appSlug.toLowerCase(),
    source.fsId ?? "",
    normalizeTransform(transform),
    model ?? "",
  ].join("\n");
  return `cf-${hashToBase36(canonical)}`;
}

/**
 * A staged (precomputed) suggestion result: a specific code version under the
 * SOURCE vibe's own owner/slug. Same `(ownerHandle, appSlug)` as the source; a
 * new `fsId`. Unpublished until the owner publishes it.
 */
export interface CachedSuggestionHit {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string;
}

/** The `/vibe` URL a cached read navigates to — the source vibe at a staged version. */
export function cachedVibeHref(hit: CachedSuggestionHit): string {
  return `/vibe/${hit.ownerHandle}/${hit.appSlug}/${hit.fsId}`;
}

// Explicit allowlist over the FULL grant union (not a denylist), so a future
// grant added to `getAppByFsId` can't silently default to "readable": the
// `Record<AppGrant, …>` makes the literal fail to compile until the new grant is
// classified, and an unrecognized runtime string falls through to `false`
// (write lane). Readable = the viewer can really load that version; everything
// that gates or is absent is not. (Charlie review — guard against grant drift.)
const READABLE_CACHED_GRANT: Record<AppGrant, boolean> = {
  "public-access": true,
  owner: true,
  "granted-access.editor": true,
  "granted-access.viewer": true,
  "granted-access.submitter": true,
  "accepted-email-invite": true,
  "revoked-access": false,
  "pending-request": false,
  "not-found": false,
  "not-grant": false,
  "req-login.invite": false,
  "req-login.request": false,
};

/**
 * Whether a `getAppByFsId` grant means a staged version is actually readable by
 * THIS viewer — so navigating to it is a real page-view, not a gate. A logged-out
 * viewer only gets a truthy answer for `public-access` (or `owner`), so the
 * "no login" promise holds: an unreadable or missing staged version falls through
 * to the write lane. (NB: serving a staged-but-unpublished version to a non-owner
 * via an explicit-fsId read is a backend question tracked on #2801.)
 */
export function isReadableCachedGrant(grant: string): boolean {
  return READABLE_CACHED_GRANT[grant as AppGrant] === true;
}

export type CachedReadDecision =
  | { readonly kind: "read"; readonly href: string; readonly hit: CachedSuggestionHit }
  | { readonly kind: "write" };

/**
 * Decide read vs write for a chip click. Computes the `(source, transform)`
 * content-address key, then asks the injected `lookup` for the staged version it
 * resolves to (or null). A hit is a READ (navigate to that version — no
 * codegen/login/fork); a miss, or ANY lookup error, soft-fails to a WRITE so the
 * existing fail-loud generation path takes over. The decision is made BEFORE
 * anything commits, and depends ONLY on whether the result exists — never on who
 * clicks. (#2801)
 */
export async function resolveCachedRead(args: {
  readonly source: CachedSuggestionSource;
  readonly transform: string;
  readonly model?: string;
  readonly lookup: (req: { key: string; source: CachedSuggestionSource }) => Promise<CachedSuggestionHit | null>;
}): Promise<CachedReadDecision> {
  const key = cachedSuggestionKey({ source: args.source, transform: args.transform, ...(args.model ? { model: args.model } : {}) });
  try {
    const hit = await args.lookup({ key, source: args.source });
    if (hit) return { kind: "read", href: cachedVibeHref(hit), hit };
  } catch {
    // Reads soft-fail to the write lane; writes keep fail-loud semantics.
  }
  return { kind: "write" };
}
