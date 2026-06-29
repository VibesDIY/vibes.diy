import { BuildURI, URI } from "@adviser/cement";
import { calcEntryPointUrl } from "@vibes.diy/api-pkg";

// #2772 D1 — which fsId the /vibe iframe pins.
//
// An explicit versioned URL (route-param `fsId`) is an explicit request and must be
// served byte-for-byte: it is NEVER overridden by the owner's draft. Only the
// unversioned owner-draft case (`fsId` absent, `draftFsId` resolved) re-pins to the
// owner's latest dev draft. With both absent the iframe stays on the unversioned
// (production) URL.
//
// This is the single source of truth for the "versioned URL no-repin" guardrail
// (spec §3b / §7). Keeping it a pure function lets the guarantee be unit-tested
// without mounting the whole route.
export function pinnedIframeFsId(fsId: string | undefined, draftFsId: string | undefined): string | undefined {
  return fsId ?? draftFsId;
}

// The owner-latest resolve, reduced to the two UI decisions: does the badge/banner
// show (`isDraft`), and should the iframe (re)pin to this draft fsId. A `dev` row
// owned by the viewer is the only draft; anything else is "up to date" → no badge,
// clear the pin.
//
// The re-pin decision is a TIMING-INDEPENDENT invariant (#2839 review): skip the
// re-pin only when the resolved draft is exactly the one already hot-swapped into the
// live iframe (`hotSwapped` = the generation's `persistedFsRef`). That happens
// precisely after an in-place edit on the current vibe — the generation pushed this
// draft's source in place, so re-pinning would change the iframe `src` and reload
// identical code (a visible flash). On EVERY other path we pin: mount (no hot-swap
// yet), publish (the resolve flips to `production`, not-a-draft branch), and cross-vibe
// navigation. The match is keyed on the FULL vibe identity (ownerHandle/appSlug/fsId),
// NOT fsId alone: storage is content-addressed and a fork shares the source's fsId
// (fork-app.ts), so navigating between a fork and its source — same fsId, different
// vibe — must still pin. No bump counters or recheck flags, so navigation cannot
// synthesize a "skip the pin" signal.
export interface OwnerLatestResolve {
  readonly error?: unknown;
  readonly grant?: string;
  readonly fsId?: string;
  readonly mode?: string;
}

export interface VibeFsRef {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fsId: string;
}

export interface OwnerDraftDecision {
  readonly isDraft: boolean;
  /** fsId to pass to `setDraftFsId` when `repin` is true. */
  readonly pinFsId: string | undefined;
  /** Whether to call `setDraftFsId(pinFsId)` at all (false only when the iframe
   *  already shows this exact draft via an in-place hot-swap on THIS vibe). */
  readonly repin: boolean;
}

export function resolveOwnerDraft(
  res: OwnerLatestResolve,
  hotSwapped: VibeFsRef | undefined,
  current: { readonly ownerHandle: string; readonly appSlug: string }
): OwnerDraftDecision {
  const isDevDraft = !res.error && res.grant === "owner" && !!res.fsId && res.mode === "dev";
  if (!isDevDraft) return { isDraft: false, pinFsId: undefined, repin: true };
  const alreadyShown =
    hotSwapped !== undefined &&
    hotSwapped.fsId === res.fsId &&
    hotSwapped.ownerHandle === current.ownerHandle &&
    hotSwapped.appSlug === current.appSlug;
  return { isDraft: true, pinFsId: res.fsId, repin: !alreadyShown };
}

export interface PinnedIframeUrlOpts {
  readonly hostnameBase: string;
  readonly protocol: string; // "https" | "http"
  readonly port?: string;
  readonly appSlug: string;
  readonly ownerHandle: string;
  /** Route-param versioned fsId (explicit; always wins). */
  readonly fsId?: string;
  /** Owner draft fsId to pin on an unversioned URL (#2772 D1). */
  readonly draftFsId?: string;
  /** Current location query params — MUST be preserved across the re-pin. */
  readonly currentParams: Record<string, string>;
  readonly npmUrl: string;
}

// Build the /vibe iframe src, pinning the resolved fsId (versioned > owner-draft >
// unversioned) and MERGING the current query params (so a `?token`/etc. survives the
// owner's draft re-pin — spec §3b). Extracted as a pure function so the re-pin's
// observable output — the right fsId pinned AND params intact — is unit-testable
// without mounting the route (guards the async draft-resolution path; Charlie D2 note).
export function buildPinnedIframeUrl(opts: PinnedIframeUrlOpts): string {
  const pinFsId = pinnedIframeFsId(opts.fsId, opts.draftFsId);
  const baseUrl = calcEntryPointUrl({
    hostnameBase: opts.hostnameBase,
    protocol: opts.protocol,
    bindings: { appSlug: opts.appSlug, ownerHandle: opts.ownerHandle, ...(pinFsId ? { fsId: pinFsId } : {}) },
    port: opts.port,
  });
  return BuildURI.from(baseUrl).searchParams(opts.currentParams, "merge").setParam("npmUrl", opts.npmUrl).toString();
}

// Re-export so the route can keep a single import for the iframe-URL concern.
export { URI };
