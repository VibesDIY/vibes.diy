import { describe, it, expect } from "vitest";
import { toRecentVibes } from "~/vibes.diy/app/components/RecentVibes.js";

function slugItem(userSlug: string, appSlugs: string[]) {
  return { userId: `uid-${userSlug}`, userSlug, appSlugs };
}

describe("toRecentVibes", () => {
  it("flattens grouped items into userSlug/appSlug pairs", () => {
    const items = [slugItem("alice", ["todo", "notes"]), slugItem("bob", ["gallery"])];
    expect(toRecentVibes(items, 20)).toEqual([
      { userSlug: "alice", appSlug: "todo" },
      { userSlug: "alice", appSlug: "notes" },
      { userSlug: "bob", appSlug: "gallery" },
    ]);
  });

  it("limits output to the requested count", () => {
    const items = [slugItem("alice", ["a1", "a2", "a3", "a4", "a5"]), slugItem("bob", ["b1", "b2", "b3"])];
    expect(toRecentVibes(items, 3)).toHaveLength(3);
    expect(toRecentVibes(items, 3)).toEqual([
      { userSlug: "alice", appSlug: "a1" },
      { userSlug: "alice", appSlug: "a2" },
      { userSlug: "alice", appSlug: "a3" },
    ]);
  });

  it("skips items with empty appSlugs arrays", () => {
    const items = [slugItem("alice", []), slugItem("bob", ["notes"])];
    expect(toRecentVibes(items, 20)).toEqual([{ userSlug: "bob", appSlug: "notes" }]);
  });

  it("returns empty array for empty input", () => {
    expect(toRecentVibes([], 20)).toEqual([]);
  });

  it("returns empty array for limit=0", () => {
    const items = [slugItem("alice", ["todo"])];
    expect(toRecentVibes(items, 0)).toEqual([]);
  });

  it("preserves order from input", () => {
    const items = [slugItem("first", ["app1"]), slugItem("second", ["app2"]), slugItem("third", ["app3"])];
    const result = toRecentVibes(items, 20);
    expect(result.map((r) => r.userSlug)).toEqual(["first", "second", "third"]);
  });
});
