import { describe, expect, it } from "vitest";
import { sharedReadShardFor, sharedApiUrl, deferredSharedReadShard } from "~/vibes.diy/app/shared-read-shard.js";
import { userNotifyShardFor } from "@vibes.diy/api-types";

describe("sharedReadShardFor", () => {
  it("anon → global", () => expect(sharedReadShardFor(undefined)).toBe("global"));
  it("authed → userNotifyShardFor", () => expect(sharedReadShardFor("user_1")).toBe(userNotifyShardFor("user_1")));
});

describe("deferredSharedReadShard — opens exactly one shared socket on the final shard", () => {
  it("returns undefined before Clerk loads, even for a signed-in user", () => {
    // THE regression guard: opening here (pre-hydration, userId not yet known)
    // would create a shard=global socket that then lingers beside the
    // post-hydration notify-user socket. Defer instead → no premature socket.
    expect(deferredSharedReadShard(false, "user_1")).toBeUndefined();
  });

  it("returns undefined before Clerk loads for an anon user too", () => {
    expect(deferredSharedReadShard(false, undefined)).toBeUndefined();
  });

  it("once loaded, an anon user gets the global shard", () => {
    expect(deferredSharedReadShard(true, undefined)).toBe("global");
  });

  it("once loaded, a signed-in user gets ONLY their notify-user shard (never global)", () => {
    const shard = deferredSharedReadShard(true, "user_1");
    expect(shard).toBe(userNotifyShardFor("user_1"));
    expect(shard).not.toBe("global");
  });
});

describe("sharedApiUrl", () => {
  const apiUrl = "ws://h/api";

  it("anon shard → /api/shared?shard=global", () => {
    const url = sharedApiUrl(apiUrl, "global");
    expect(url).toMatch(/\/api\/shared\?shard=global$/);
  });

  it("user shard → /api/shared?shard=<userNotifyShardFor(userId)>", () => {
    const shard = userNotifyShardFor("user_1");
    const url = sharedApiUrl(apiUrl, shard);
    expect(url).toContain("/api/shared?shard=");
    expect(url).toContain(shard);
  });

  it("strips pre-existing params from base apiUrl", () => {
    // buildSharedApi is called with the raw apiUrl which may have stray params
    const url = sharedApiUrl("ws://h/api?stray=1", "global");
    expect(url).not.toContain("stray");
    expect(url).toMatch(/\/api\/shared\?shard=global$/);
  });
});
