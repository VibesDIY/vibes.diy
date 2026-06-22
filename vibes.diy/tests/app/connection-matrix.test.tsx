// Connection-matrix test: asserts the eager shared-plane target per route × auth.
//
// APPROACH: helper-level rather than full-provider-mount.
//
// The provider's module-level `vibesDiyApis` KeyedResolvOnce cache + the
// `VibesDiyApi` constructor's eager WebSocket open make unit-testing the full
// provider mount impractical without a real WebSocket server or invasive module
// stubs. Instead, we test the resolution logic by composing the same extracted
// helpers the provider calls:
//   vibeApiTarget(pathname)      → is this a vibe route?
//   sharedReadShardFor(userId)   → which shard?
//   sharedApiUrl(apiUrl, shard)  → the SharedSessions URL
//   BuildURI …/api/app?vibe=…   → the AppSessions URL (inline, same as provider)
//
// The live eager-socket COUNT (exactly one WS per page load) is verified at
// runtime in Phase 6 via the chrome-devtools MCP network inspector.
import { describe, expect, it } from "vitest";
import { BuildURI } from "@adviser/cement";
import { userNotifyShardFor } from "@vibes.diy/api-types";
import { vibeApiTarget } from "~/vibes.diy/app/vibe-api-target.js";
import { sharedReadShardFor, sharedApiUrl } from "~/vibes.diy/app/shared-read-shard.js";

const API_URL = "ws://api.example.com/api";

/**
 * Mirrors the provider's `buildAppApi` URL construction (vibes-diy-provider.tsx:258).
 * Returns the AppSessions WS URL for a given vibe key.
 */
function appApiUrl(apiUrl: string, vibeKey: string): string {
  return BuildURI.from(apiUrl).pathname("/api/app").cleanParams().setParam("vibe", vibeKey).toString();
}

/**
 * Resolve which shared-plane URL(s) the provider would open for a given
 * pathname + optional userId, using the same logic as LiveCycleVibesDiyProvider.
 *
 * Returns:
 *   - sharedUrl: the eager socket URL the provider builds for this route×auth cell
 *   - isVibeRoute: true when sharedApi === vibeApi (vibe route, no separate shared WS)
 */
function resolveConnectionTarget(
  pathname: string,
  userId: string | undefined,
  apiUrl: string = API_URL
): { sharedUrl: string; appUrl: string | undefined; isVibeRoute: boolean } {
  const target = vibeApiTarget(pathname);

  if (target !== undefined) {
    // Vibe route: sharedApi = vibeApi (AppSessions). No separate /api/shared socket.
    const vibeKey = `${target.ownerHandle}--${target.appSlug}`;
    const url = appApiUrl(apiUrl, vibeKey);
    return { sharedUrl: url, appUrl: url, isVibeRoute: true };
  }

  // Non-vibe route: SharedSessions socket, shard derived from auth state.
  const shard = sharedReadShardFor(userId);
  const url = sharedApiUrl(apiUrl, shard);
  return { sharedUrl: url, appUrl: undefined, isVibeRoute: false };
}

describe("connection-matrix — shared-plane target per route × auth", () => {
  describe("vibe route — any auth", () => {
    it("uses /api/app?vibe= URL (AppSessions)", () => {
      const { sharedUrl, appUrl, isVibeRoute } = resolveConnectionTarget("/vibe/alice/my-app", undefined);
      expect(isVibeRoute).toBe(true);
      expect(sharedUrl).toContain("/api/app");
      expect(sharedUrl).toContain("vibe=alice--my-app");
      expect(appUrl).toBe(sharedUrl); // sharedApi === vibeApi on vibe routes
    });

    it("uses /api/app?vibe= URL for /chat/ editor routes (authed)", () => {
      const { sharedUrl, isVibeRoute } = resolveConnectionTarget("/chat/bob/cool-app", "user_99");
      expect(isVibeRoute).toBe(true);
      expect(sharedUrl).toContain("/api/app");
      expect(sharedUrl).toContain("vibe=bob--cool-app");
    });

    it("does NOT open a /api/shared URL on vibe routes", () => {
      const { sharedUrl, isVibeRoute } = resolveConnectionTarget("/vibe/alice/my-app", "user_1");
      expect(isVibeRoute).toBe(true);
      expect(sharedUrl).not.toContain("/api/shared");
    });

    it("encodes ownerHandle and appSlug as vibeKey", () => {
      const { sharedUrl } = resolveConnectionTarget("/vibe/charlie/super-notes", undefined);
      expect(sharedUrl).toContain("vibe=charlie--super-notes");
    });
  });

  describe("non-vibe route, authed", () => {
    const userId = "user_abc123";

    it("opens /api/shared?shard=<userNotifyShardFor(userId)>", () => {
      const { sharedUrl, isVibeRoute } = resolveConnectionTarget("/settings", userId);
      expect(isVibeRoute).toBe(false);
      expect(sharedUrl).toContain("/api/shared");
      const expectedShard = userNotifyShardFor(userId);
      expect(sharedUrl).toContain(`shard=${expectedShard}`);
    });

    it("does NOT open /api/app on non-vibe routes", () => {
      const { appUrl } = resolveConnectionTarget("/settings", userId);
      expect(appUrl).toBeUndefined();
    });

    it("the shard matches sharedReadShardFor(userId)", () => {
      const expectedShard = sharedReadShardFor(userId);
      const { sharedUrl } = resolveConnectionTarget("/settings", userId);
      expect(sharedUrl).toContain(`shard=${expectedShard}`);
    });

    it("works for the home route /", () => {
      const { sharedUrl, isVibeRoute } = resolveConnectionTarget("/", userId);
      expect(isVibeRoute).toBe(false);
      expect(sharedUrl).toContain("/api/shared");
      expect(sharedUrl).toContain(`shard=${userNotifyShardFor(userId)}`);
    });

    it("works for /messages route", () => {
      const { sharedUrl, isVibeRoute } = resolveConnectionTarget("/messages", userId);
      expect(isVibeRoute).toBe(false);
      expect(sharedUrl).toContain("/api/shared");
    });
  });

  describe("non-vibe route, anon", () => {
    it("opens /api/shared?shard=global", () => {
      const { sharedUrl, isVibeRoute } = resolveConnectionTarget("/settings", undefined);
      expect(isVibeRoute).toBe(false);
      expect(sharedUrl).toContain("/api/shared");
      expect(sharedUrl).toContain("shard=global");
    });

    it("does NOT open /api/app on non-vibe anon routes", () => {
      const { appUrl } = resolveConnectionTarget("/settings", undefined);
      expect(appUrl).toBeUndefined();
    });

    it("global shard is used for the root route", () => {
      const { sharedUrl } = resolveConnectionTarget("/", undefined);
      expect(sharedUrl).toMatch(/\/api\/shared\?shard=global$/);
    });

    it("global shard is used for /messages anon", () => {
      const { sharedUrl } = resolveConnectionTarget("/messages", undefined);
      expect(sharedUrl).toContain("shard=global");
    });
  });

  describe("sharedReadShardFor — shard seam", () => {
    it("anon always gets 'global'", () => {
      expect(sharedReadShardFor(undefined)).toBe("global");
    });

    it("authed gets userNotifyShardFor(userId)", () => {
      const userId = "user_xyz";
      expect(sharedReadShardFor(userId)).toBe(userNotifyShardFor(userId));
    });

    it("different users get different shards", () => {
      const shard1 = sharedReadShardFor("user_1");
      const shard2 = sharedReadShardFor("user_2");
      expect(shard1).not.toBe(shard2);
    });
  });
});
