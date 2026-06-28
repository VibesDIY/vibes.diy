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
