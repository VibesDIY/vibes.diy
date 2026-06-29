import { describe, it, expect } from "vitest";

// The conditional visibility logic is a pure function of two booleans.
// Extracted here so it can be unit-tested without mounting the full component.
function iframeVisible(isWorldReadable: boolean, isAccessGranted: boolean): boolean {
  return isWorldReadable || isAccessGranted;
}

function showPointerBlocker(isWorldReadable: boolean, cardGrant: string | undefined): boolean {
  return isWorldReadable && cardGrant === undefined;
}

// A world-readable vibe paints the live app full-screen in the FIXED iframe, so
// the in-flow landing-card overlay would render behind it (the card backing is
// lost and the CTAs float unreadably over the running app). For the persistent
// landing states (access card / not-found) the overlay is lifted above the
// iframe with a dim scrim; the transient loading state and non-readable vibes
// keep the in-flow grid background. Mirror of `liftCardOverApp` in the route.
function liftCardOverApp(isWorldReadable: boolean, showCard: boolean, notFound: boolean): boolean {
  return isWorldReadable && (showCard || notFound);
}

describe("vibe route iframe visibility logic", () => {
  it("hidden by default (private app, grant unknown)", () => {
    expect(iframeVisible(false, false)).toBe(false);
  });

  it("visible immediately for world-readable app before grant check returns", () => {
    expect(iframeVisible(true, false)).toBe(true);
  });

  it("visible once grant resolves for private app", () => {
    expect(iframeVisible(false, true)).toBe(true);
  });

  it("pointer-blocker shown while world-readable and grant is loading", () => {
    expect(showPointerBlocker(true, undefined)).toBe(true);
  });

  it("pointer-blocker hidden once grant resolves (any grant value)", () => {
    expect(showPointerBlocker(true, "owner")).toBe(false);
    expect(showPointerBlocker(true, "public-access")).toBe(false);
    expect(showPointerBlocker(true, "not-grant")).toBe(false);
  });

  it("pointer-blocker never shown for private apps", () => {
    expect(showPointerBlocker(false, undefined)).toBe(false);
  });
});

describe("landing-card overlay layering", () => {
  it("lifts the card above the live app for a world-readable access-card vibe", () => {
    // The bug: without lifting, the access card paints behind the full-screen
    // iframe and the Install/Request CTAs read as backing-less floating buttons.
    expect(liftCardOverApp(true, true, false)).toBe(true);
  });

  it("lifts the not-found message above the live app when world-readable", () => {
    expect(liftCardOverApp(true, false, true)).toBe(true);
  });

  it("stays out of the way during the transient loading state (world-readable)", () => {
    expect(liftCardOverApp(true, false, false)).toBe(false);
  });

  it("keeps the in-flow grid background for non-readable vibes (no live app behind)", () => {
    expect(liftCardOverApp(false, true, false)).toBe(false);
    expect(liftCardOverApp(false, false, true)).toBe(false);
  });
});
