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
