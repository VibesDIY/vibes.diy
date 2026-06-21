import { describe, expect, it } from "vitest";
import { vibeApiTarget } from "~/vibes.diy/app/vibe-api-target.js";

describe("vibeApiTarget", () => {
  it("matches a /vibe/ viewer route", () => {
    expect(vibeApiTarget("/vibe/alice/notes")).toEqual({ ownerHandle: "alice", appSlug: "notes" });
  });

  it("matches a /chat/ editor route", () => {
    expect(vibeApiTarget("/chat/alice/notes")).toEqual({ ownerHandle: "alice", appSlug: "notes" });
  });

  it("matches a /chat/ editor route with a trailing fsId segment", () => {
    expect(vibeApiTarget("/chat/alice/notes/abc123")).toEqual({ ownerHandle: "alice", appSlug: "notes" });
  });

  it("returns undefined for the new-chat prompt route", () => {
    expect(vibeApiTarget("/chat/prompt")).toBeUndefined();
  });

  it("returns undefined for placeholder editor params", () => {
    expect(vibeApiTarget("/chat/preparing/session")).toBeUndefined();
  });

  it("returns undefined for non-vibe, non-chat routes", () => {
    expect(vibeApiTarget("/")).toBeUndefined();
    expect(vibeApiTarget("/settings")).toBeUndefined();
  });

  it("returns undefined for /messages routes (DMs ride a standalone appApiFor connection, not the iframe vibeApi target) (#2265 A2)", () => {
    // Guard against re-coupling DM routes to iframe-route behavior: DMs build
    // their AppSessions connection via appApiFor(`<channelUserSlug>--dm`), not by
    // being treated as a vibe-iframe route.
    expect(vibeApiTarget("/messages")).toBeUndefined();
    expect(vibeApiTarget("/messages/alice/bob")).toBeUndefined();
  });
});
