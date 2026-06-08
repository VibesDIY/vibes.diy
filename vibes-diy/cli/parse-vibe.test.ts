import { describe, expect, it } from "vitest";
import { parseVibe, resolveVibeArgs } from "./parse-vibe.js";

describe("parseVibe", () => {
  it("splits handle/app-slug into both parts", () => {
    expect(parseVibe("jchris/hat-smeller")).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller",
    });
  });

  it("returns bare app-slug with no handle when there is no slash", () => {
    expect(parseVibe("hat-smeller")).toEqual({
      handle: undefined,
      appSlug: "hat-smeller",
    });
  });

  it("handles empty string as bare app-slug", () => {
    expect(parseVibe("")).toEqual({
      handle: undefined,
      appSlug: "",
    });
  });

  it("only splits on the first slash", () => {
    expect(parseVibe("jchris/hat-smeller/extra")).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller/extra",
    });
  });
});

describe("resolveVibeArgs", () => {
  it("--vibe wins: extracts both handle and appSlug", () => {
    expect(resolveVibeArgs({ vibe: "jchris/hat-smeller", handle: "", appSlug: "", positionalAppSlug: "" })).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller",
    });
  });

  it("--vibe bare slug: sets appSlug only", () => {
    expect(resolveVibeArgs({ vibe: "hat-smeller", handle: "", appSlug: "", positionalAppSlug: "" })).toEqual({
      handle: "",
      appSlug: "hat-smeller",
    });
  });

  it("throws when --vibe conflicts with explicit --handle", () => {
    expect(() =>
      resolveVibeArgs({ vibe: "jchris/hat-smeller", handle: "other-user", appSlug: "", positionalAppSlug: "" }),
    ).toThrowError('Conflicting values: --vibe "jchris/hat-smeller" disagrees with --handle "other-user"');
  });

  it("throws when --vibe conflicts with explicit --app-slug", () => {
    expect(() =>
      resolveVibeArgs({ vibe: "jchris/hat-smeller", handle: "", appSlug: "other-app", positionalAppSlug: "" }),
    ).toThrowError('Conflicting values: --vibe "jchris/hat-smeller" disagrees with --app-slug "other-app"');
  });

  it("allows equivalent --vibe + explicit --handle/--app-slug", () => {
    expect(
      resolveVibeArgs({
        vibe: "jchris/hat-smeller",
        handle: "jchris",
        appSlug: "hat-smeller",
        positionalAppSlug: "",
      }),
    ).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller",
    });
  });

  it("--handle + --app-slug: uses both directly", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "jchris", appSlug: "hat-smeller", positionalAppSlug: "" })).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller",
    });
  });

  it("positional handle/app-slug: splits when no explicit flags", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "", positionalAppSlug: "jchris/hat-smeller" })).toEqual({
      handle: "jchris",
      appSlug: "hat-smeller",
    });
  });

  it("positional bare app-slug: handle stays empty", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "", positionalAppSlug: "hat-smeller" })).toEqual({
      handle: "",
      appSlug: "hat-smeller",
    });
  });

  it("explicit --handle overrides handle parsed from positional", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "other-user", appSlug: "", positionalAppSlug: "jchris/hat-smeller" })).toEqual({
      handle: "other-user",
      appSlug: "hat-smeller",
    });
  });

  it("--app-slug overrides appSlug parsed from positional", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "override-slug", positionalAppSlug: "jchris/hat-smeller" })).toEqual({
      handle: "jchris",
      appSlug: "override-slug",
    });
  });

  it("--vibe overrides positional entirely", () => {
    expect(resolveVibeArgs({ vibe: "alice/cool-app", handle: "", appSlug: "", positionalAppSlug: "jchris/hat-smeller" })).toEqual({
      handle: "alice",
      appSlug: "cool-app",
    });
  });

  it("all empty: returns empty strings", () => {
    expect(resolveVibeArgs({ vibe: "", handle: "", appSlug: "", positionalAppSlug: "" })).toEqual({
      handle: "",
      appSlug: "",
    });
  });
});
