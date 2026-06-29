/**
 * Cached-read chip lane + system-owned cached-fork infra — the READ half of the
 * chip model (#2801). Browser-safe and pure (only a type-only intra-package
 * import, which erases at runtime).
 *
 * The epic's core boundary is **cached chip = read** (navigate to an
 * already-generated vibe — no codegen, no login, nothing forked) vs **Other /
 * uncached = write** (real codegen, login at that moment, implicit fork). Only
 * the write lane shipped. This module is the read lane's decidable core:
 *
 *  1. {@link SYSTEM_CACHE_HANDLE} — the reserved platform handle that OWNS the
 *     pre-made forks. "System is just another owner" (epic note §2/§8), so the
 *     existing slug-vs-fsId + fork rules cover cached content uniformly.
 *  2. {@link cachedForkKey} — the content-address dedupe key `(source,
 *     transform)`. The SAME transform of the SAME source resolves to the SAME
 *     pre-made fork instead of regenerating (an O(1) read, not a codegen).
 *     The key is a slug, so the dedupe index is just the `apps` table under the
 *     system handle — no separate D1 table is needed (resolves OQ#1).
 *  3. {@link resolveCachedRead} — the read/write decision, made BEFORE anything
 *     commits. A hit is a read (navigate); a miss or ANY lookup error soft-fails
 *     to the write lane (writes keep their fail-loud semantics).
 *
 * Design source: notes/2026-06-26-agent-in-vibe-ux-epic.md §1a/§2/§8 and
 * docs/superpowers/specs/2026-06-28-cached-fork-infra-design.md.
 */

import type { ResGetAppByFsId } from "./app.js";

/** The grant union `getAppByFsId` returns for a viewer on an app. */
type AppGrant = ResGetAppByFsId["grant"];

/**
 * The reserved platform/system handle that owns pre-made (cached) forks.
 *
 * Curated starters and precached transforms live under this handle as ordinary
 * public apps; an anonymous browser reading the cached tree is just reading
 * system-owned public apps. It MUST be a valid lowercase slug and MUST be
 * reserved out of the normal user-handle space so no real account can register
 * it — enforcing that reservation in the handle-provisioning path is the backend
 * follow-up; this constant is the single source of truth both sides key off.
 */
export const SYSTEM_CACHE_HANDLE = "system";

/** True when a vibe's owner handle is the reserved cached-fork system handle. */
export function isSystemCacheHandle(handle: string | undefined): boolean {
  return handle === SYSTEM_CACHE_HANDLE;
}

/** What a cached fork forks FROM: a source app/version. */
export interface CachedForkSource {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** The code version the transform applies to. Omit to key on the slug alone
   *  (the curated-starter case, where "latest" is implied). */
  readonly fsId?: string;
}

export interface CachedForkKeyInput {
  readonly source: CachedForkSource;
  /** The chip prompt / typed edit that produced the cached fork. */
  readonly transform: string;
  /** Codegen model+version, folded into the key so the same English transform
   *  under a different model resolves to a DIFFERENT fork. Optional — omit for
   *  model-agnostic dedupe. */
  readonly model?: string;
}

/**
 * Canonicalize a chip prompt / typed edit so trivially-different strings dedupe
 * to one cached fork (resolves OQ#2). Strips a leading `▸` chip marker,
 * lowercases, collapses internal whitespace, trims, and drops trailing sentence
 * punctuation. Model/version is folded in separately by {@link cachedForkKey}'s
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
// staying well inside the 32-char slug budget.
function hashToBase36(input: string): string {
  const a = fnv1a(input).toString(36);
  // A visible salt decorrelates the second hash from the first, so the combined
  // key spans ~64 bits rather than one 32-bit hash repeated.
  const b = fnv1a(`cf-salt:${input}`).toString(36);
  return `${a}-${b}`;
}

/**
 * The content-address dedupe key for `(source, transform[, model])`, returned as
 * a slug-safe (`[a-z0-9-]`, ≤32 chars) string. Deterministic: identical inputs
 * always produce the same key, so a precached fork is found by an O(1) slug read
 * instead of regenerating. Fields are joined with a newline — which
 * normalizeTransform strips and a handle/slug can't contain — so distinct inputs
 * can't alias by concatenation.
 */
export function cachedForkKey(input: CachedForkKeyInput): string {
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

/** A cached system fork's addressable `/vibe` identity. */
export interface CachedForkRef {
  /** Always {@link SYSTEM_CACHE_HANDLE}. */
  readonly ownerHandle: string;
  /** The content-address key from {@link cachedForkKey}. */
  readonly appSlug: string;
}

/** Resolve a `(source, transform)` to the system-fork ref it would dedupe to. */
export function cachedForkRef(input: CachedForkKeyInput): CachedForkRef {
  return { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: cachedForkKey(input) };
}

/** The `/vibe` URL a cached read navigates to. */
export function cachedForkHref(ref: CachedForkRef): string {
  return `/vibe/${ref.ownerHandle}/${ref.appSlug}`;
}

// Explicit allowlist over the FULL grant union (not a denylist), so a future
// grant added to `getAppByFsId` can't silently default to "readable": the
// `Record<AppGrant, …>` makes the literal fail to compile until the new grant is
// classified, and an unrecognized runtime string falls through to `false`
// (write lane). Readable = the viewer can really load the app; everything that
// gates or is absent is not. (Charlie review — guard against grant drift.)
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
 * Whether a `getAppByFsId` grant means the cached system fork is actually
 * readable by THIS viewer — so navigating to it is a real page-view, not a gate.
 * A logged-out viewer only gets a truthy answer for `public-access` (and
 * `owner`, which never happens under the system handle), so the "no login"
 * promise holds: a non-public or missing cached fork falls through to the write
 * lane.
 */
export function isReadableCachedGrant(grant: string): boolean {
  return READABLE_CACHED_GRANT[grant as AppGrant] === true;
}

export type CachedReadDecision =
  | { readonly kind: "read"; readonly href: string; readonly ref: CachedForkRef }
  | { readonly kind: "write" };

/**
 * Decide read vs write for a chip click. Resolves the `(source, transform)`
 * content address to a system-fork ref, then asks the injected `lookup` whether
 * a readable cached fork exists at it. A hit is a READ (navigate — no
 * login/codegen/fork); a miss, or ANY lookup error, soft-fails to a WRITE so the
 * existing fail-loud generation path takes over. The decision is made BEFORE
 * anything commits — the spec's read/write (and login/fork) boundary. (#2801)
 */
export async function resolveCachedRead(args: {
  readonly source: CachedForkSource;
  readonly transform: string;
  readonly model?: string;
  readonly lookup: (ref: CachedForkRef) => Promise<boolean>;
}): Promise<CachedReadDecision> {
  const ref = cachedForkRef({ source: args.source, transform: args.transform, ...(args.model ? { model: args.model } : {}) });
  try {
    if (await args.lookup(ref)) return { kind: "read", href: cachedForkHref(ref), ref };
  } catch {
    // Reads soft-fail to the write lane; writes keep fail-loud semantics.
  }
  return { kind: "write" };
}
