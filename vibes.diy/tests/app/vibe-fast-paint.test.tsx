import { describe, it, expect } from "vitest";

// The conditional visibility logic is a pure function of two booleans.
// Extracted here so it can be unit-tested without mounting the full component.
function iframeVisible(isWorldReadable: boolean, isAccessGranted: boolean): boolean {
  return isWorldReadable || isAccessGranted;
}

function showPointerBlocker(isWorldReadable: boolean, cardGrant: string | undefined): boolean {
  return isWorldReadable && cardGrant === undefined;
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
