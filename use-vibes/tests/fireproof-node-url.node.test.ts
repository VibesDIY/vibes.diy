import { it, expect } from "vitest";
import { buildVibeApiUrl } from "../base/fireproof-node.js";

it("builds the canonical /api/app?vibe=owner--app url", () => {
  expect(buildVibeApiUrl("https://vibes.diy/api", "alice", "todos")).toBe("https://vibes.diy/api/app?vibe=alice--todos");
});
