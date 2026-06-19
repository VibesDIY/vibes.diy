import { describe, expect, it } from "vitest";
import { vibePkgCacheControl } from "../workers/vibe-pkg-cache.js";

const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=60";

describe("vibePkgCacheControl", () => {
  it("caches stamped URLs immutably for a year", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/vibe-runtime?v=abc123")).toBe(IMMUTABLE);
  });

  it("treats any non-empty ?v= stamp as immutable (preview github.sha)", () => {
    expect(vibePkgCacheControl("https://vibes-diy-pr-1234.vibesdiy.net/vibe-pkg/@vibes.diy/base?v=deadbeefcafebabe")).toBe(
      IMMUTABLE
    );
  });

  it("falls back to a 60s TTL for unstamped URLs (trailing-slash subpaths)", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/vibe-runtime/dist/react.js")).toBe(SHORT);
  });

  it("falls back to a 60s TTL when ?v= is present but empty", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/vibe-runtime?v=")).toBe(SHORT);
  });

  it("ignores unrelated query params", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/base?deps=react@19.2.1")).toBe(SHORT);
  });

  it("keeps the stamp decision when other params accompany ?v=", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/ag-grid-react?v=abc123&deps=react@19.2.1")).toBe(IMMUTABLE);
  });
});
