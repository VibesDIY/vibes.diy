import { describe, it, expect } from "vitest";
import { directChannelUserSlug, directChannelParticipants, isDirectChannel } from "@vibes.diy/api-types";

describe("directChannelUserSlug", () => {
  it("sorts participants lexicographically so a→b and b→a produce the same slug", () => {
    expect(directChannelUserSlug("alice", "bob")).toBe(directChannelUserSlug("bob", "alice"));
  });

  it("produces the _d. prefix", () => {
    expect(directChannelUserSlug("alice", "bob")).toMatch(/^_d\./);
  });

  it("puts the lexicographically smaller slug first", () => {
    expect(directChannelUserSlug("zebra", "ant")).toBe("_d.ant.zebra");
  });

  it("handles equal slugs (degenerate case)", () => {
    expect(directChannelUserSlug("alice", "alice")).toBe("_d.alice.alice");
  });

  it("handles hyphenated slugs", () => {
    expect(directChannelUserSlug("garden-gnome", "jchris")).toBe("_d.garden-gnome.jchris");
  });
});

describe("isDirectChannel", () => {
  it("returns true for valid direct-channel slugs", () => {
    expect(isDirectChannel("_d.alice.bob")).toBe(true);
    expect(isDirectChannel("_d.garden-gnome.jchris")).toBe(true);
  });

  it("returns false for regular user slugs", () => {
    expect(isDirectChannel("alice")).toBe(false);
    expect(isDirectChannel("jchris")).toBe(false);
    expect(isDirectChannel("")).toBe(false);
  });

  it("returns false for slugs that share a prefix but not the exact _d. prefix", () => {
    expect(isDirectChannel("_direct.alice.bob")).toBe(false);
    expect(isDirectChannel("d.alice.bob")).toBe(false);
  });
});

describe("directChannelParticipants", () => {
  it("round-trips with directChannelUserSlug", () => {
    const slug = directChannelUserSlug("alice", "bob");
    const parts = directChannelParticipants(slug);
    expect(parts).not.toBeNull();
    expect(parts!.sort()).toEqual(["alice", "bob"]);
  });

  it("returns null for non-channel slugs", () => {
    expect(directChannelParticipants("alice")).toBeNull();
    expect(directChannelParticipants("jchris")).toBeNull();
    expect(directChannelParticipants("")).toBeNull();
  });

  it("returns null for malformed _d. slugs with missing second participant", () => {
    expect(directChannelParticipants("_d.alice.")).toBeNull();
    expect(directChannelParticipants("_d..bob")).toBeNull();
  });

  it("handles hyphenated slugs correctly", () => {
    const slug = directChannelUserSlug("garden-gnome", "jchris");
    const parts = directChannelParticipants(slug);
    expect(parts).not.toBeNull();
    expect(parts!.sort()).toEqual(["garden-gnome", "jchris"]);
  });
});
