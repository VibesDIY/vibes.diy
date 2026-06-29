import { describe, it, expect } from "vitest";
import { pinnedIframeFsId, buildPinnedIframeUrl, resolveOwnerDraft } from "~/vibes.diy/app/routes/vibe-draft-pin.js";

// #2772 D1 — the "versioned URL no-repin" guardrail (spec §3b / §7).
describe("pinnedIframeFsId", () => {
  it("NEVER overrides an explicit versioned URL with the owner's draft", () => {
    // A route-param fsId is an explicit request → byte-for-byte unchanged for the owner.
    expect(pinnedIframeFsId("v123", "draft999")).toBe("v123");
  });

  it("pins the owner's draft fsId on an unversioned URL", () => {
    expect(pinnedIframeFsId(undefined, "draft999")).toBe("draft999");
  });

  it("stays unversioned (production) when neither is set", () => {
    expect(pinnedIframeFsId(undefined, undefined)).toBeUndefined();
  });
});

// #2772 D1/D2 — the iframe URL the owner-draft re-pin produces (Charlie's D2 note:
// guard the async re-pin output, incl. query-param preservation, without mounting
// the route). calcEntryPointUrl encodes the pinned fsId as `~fsId~` in the path.
describe("buildPinnedIframeUrl", () => {
  const base = {
    hostnameBase: "vibesdiy.app",
    protocol: "https",
    appSlug: "bloom",
    ownerHandle: "meghan",
    npmUrl: "https://pkg.example/npm",
  };

  it("pins the owner's draft fsId AND preserves the current query params on an unversioned URL", () => {
    const url = buildPinnedIframeUrl({ ...base, draftFsId: "zDRAFT123", currentParams: { token: "abc", ref: "x" } });
    expect(url).toContain("~zDRAFT123~"); // re-pinned to the draft version
    expect(url).toContain("token=abc"); // ?token survives the re-pin
    expect(url).toContain("ref=x");
    expect(url).toContain("npmUrl=");
  });

  it("NEVER re-pins a versioned URL: the route fsId wins over any draft, params still preserved", () => {
    const url = buildPinnedIframeUrl({ ...base, fsId: "zVERSION9", draftFsId: "zDRAFT123", currentParams: { token: "abc" } });
    expect(url).toContain("~zVERSION9~");
    expect(url).not.toContain("zDRAFT123");
    expect(url).toContain("token=abc");
  });

  it("stays unversioned (no ~fsId~ path) when there is no draft", () => {
    const url = buildPinnedIframeUrl({ ...base, currentParams: {} });
    expect(url).not.toMatch(/~z[^~]+~/);
  });
});

// The draft resolver's two UI outputs: show the badge (`isDraft`) and whether to
// (re)pin the iframe to the draft fsId. The re-pin decision is a timing-independent
// comparison against the fsId already hot-swapped into the live iframe (#2839 review).
describe("resolveOwnerDraft", () => {
  const devDraft = { grant: "owner", fsId: "zDRAFT123", mode: "dev" };

  it("flags a draft and PINS it on mount (nothing hot-swapped yet — hotSwapped undefined)", () => {
    expect(resolveOwnerDraft(devDraft, undefined)).toEqual({ isDraft: true, pinFsId: "zDRAFT123", repin: true });
  });

  it("flags the draft but SKIPS the re-pin when the iframe already shows this exact draft", () => {
    // After an in-place edit the generation hot-swapped THIS draft's source in place,
    // so draftFsId is left untouched — no reload of identical code.
    expect(resolveOwnerDraft(devDraft, "zDRAFT123")).toEqual({ isDraft: true, pinFsId: "zDRAFT123", repin: false });
  });

  it("PINS when the hot-swapped fsId belongs to a different draft (e.g. cross-vibe nav)", () => {
    // A different vibe's persistedFsId can never equal this vibe's resolved fsId, so
    // the destination vibe's first resolve always pins — no synthetic skip.
    expect(resolveOwnerDraft(devDraft, "zOTHER-VIBE")).toEqual({ isDraft: true, pinFsId: "zDRAFT123", repin: true });
  });

  it("clears the draft (up to date) when the latest is production", () => {
    expect(resolveOwnerDraft({ grant: "owner", fsId: "zPROD1", mode: "production" }, "zDRAFT123")).toEqual({
      isDraft: false,
      pinFsId: undefined,
      repin: true,
    });
  });

  it("ignores a non-owner grant or an error result", () => {
    expect(resolveOwnerDraft({ grant: "viewer", fsId: "zX", mode: "dev" }, undefined).isDraft).toBe(false);
    expect(resolveOwnerDraft({ error: "boom", grant: "owner", fsId: "zX", mode: "dev" }, undefined).isDraft).toBe(false);
  });

  it("ignores a dev result with no fsId", () => {
    expect(resolveOwnerDraft({ grant: "owner", mode: "dev" }, undefined).isDraft).toBe(false);
  });
});
