import { describe, it, expect } from "vitest";
import { readIntent, withIntent, withoutIntent } from "../../pkg/app/routes/vibe-intent.js";

describe("readIntent", () => {
  it("returns 'install' when ?intent=install is present", () => {
    expect(readIntent(new URLSearchParams("intent=install"))).toBe("install");
  });
  it("returns 'join' when ?intent=join is present", () => {
    expect(readIntent(new URLSearchParams("intent=join"))).toBe("join");
  });
  it("returns undefined when intent is missing", () => {
    expect(readIntent(new URLSearchParams(""))).toBeUndefined();
  });
  it("returns undefined when intent has an unrecognized value", () => {
    expect(readIntent(new URLSearchParams("intent=bogus"))).toBeUndefined();
  });
});

describe("withIntent", () => {
  it("appends intent=install to a path with no query", () => {
    expect(withIntent("/vibe/og/app", "install")).toBe("/vibe/og/app?intent=install");
  });
  it("appends intent=join alongside existing params", () => {
    expect(withIntent("/vibe/og/app?token=abc", "join")).toBe("/vibe/og/app?token=abc&intent=join");
  });
  it("replaces any existing intent param", () => {
    expect(withIntent("/vibe/og/app?intent=install", "join")).toBe("/vibe/og/app?intent=join");
  });
});

describe("withoutIntent", () => {
  it("removes intent while preserving other params", () => {
    expect(withoutIntent("/vibe/og/app?token=abc&intent=join")).toBe("/vibe/og/app?token=abc");
  });
  it("is a no-op when intent isn't present", () => {
    expect(withoutIntent("/vibe/og/app?token=abc")).toBe("/vibe/og/app?token=abc");
  });
  it("strips trailing '?' when intent was the only param", () => {
    expect(withoutIntent("/vibe/og/app?intent=install")).toBe("/vibe/og/app");
  });
});
