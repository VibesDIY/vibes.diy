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
});
