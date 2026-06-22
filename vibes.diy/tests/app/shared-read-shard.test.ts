import { describe, expect, it } from "vitest";
import { sharedReadShardFor } from "~/vibes.diy/app/shared-read-shard.js";
import { userNotifyShardFor } from "@vibes.diy/api-types";

describe("sharedReadShardFor", () => {
  it("anon → global", () => expect(sharedReadShardFor(undefined)).toBe("global"));
  it("authed → userNotifyShardFor", () => expect(sharedReadShardFor("user_1")).toBe(userNotifyShardFor("user_1")));
});
