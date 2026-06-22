import { describe, expect, it } from "vitest";
import { sharedReadShardFor, sharedApiUrl } from "~/vibes.diy/app/shared-read-shard.js";
import { userNotifyShardFor } from "@vibes.diy/api-types";

describe("sharedReadShardFor", () => {
  it("anon → global", () => expect(sharedReadShardFor(undefined)).toBe("global"));
  it("authed → userNotifyShardFor", () => expect(sharedReadShardFor("user_1")).toBe(userNotifyShardFor("user_1")));
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
