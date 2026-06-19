import { describe, expect, it } from "vitest";
import { vibePkgCacheControl } from "../workers/vibe-pkg-cache.js";

const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=60";

// This worker was deployed with WORKSPACE_NPM_URL stamped at this SHA.
const OWN = "https://prod-v2.vibesdiy.net/vibe-pkg/?v=abc123";

describe("vibePkgCacheControl", () => {
  it("caches immutably when the request stamp matches the worker's own stamp", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/vibe-runtime?v=abc123", OWN)).toBe(IMMUTABLE);
  });

  it("keeps the match decision when other params accompany ?v=", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/ag-grid-react?v=abc123&deps=react@19.2.1", OWN)).toBe(
      IMMUTABLE
    );
  });

  it("does NOT cache immutably when the request stamp is for a different (future) deploy", () => {
    // Rollout race: a request for the next deploy's SHA reaches this old worker.
    // Caching its old bytes under the new URL immutably would strand clients.
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/vibe-runtime?v=newsha999", OWN)).toBe(SHORT);
  });

  it("falls back to a 60s TTL for unstamped URLs (trailing-slash subpaths)", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/vibe-runtime/dist/react.js", OWN)).toBe(SHORT);
  });

  it("falls back to a 60s TTL when ?v= is present but empty", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/vibe-runtime?v=", OWN)).toBe(SHORT);
  });

  it("falls back to a 60s TTL when the worker has no stamp (dev WORKSPACE_NPM_URL)", () => {
    expect(
      vibePkgCacheControl("https://localhost:8787/vibe-pkg/@vibes.diy/base?v=abc123", "https://localhost:8787/vibe-pkg/")
    ).toBe(SHORT);
  });

  it("falls back to a 60s TTL when no worker stamp is provided at all", () => {
    expect(vibePkgCacheControl("https://prod-v2.vibesdiy.net/vibe-pkg/@vibes.diy/base?v=abc123")).toBe(SHORT);
  });
});
