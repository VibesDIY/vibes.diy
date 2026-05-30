import { describe, it, expect } from "vitest";
import { deriveIsWorldReadable } from "@vibes.diy/api-svc/intern/get-vibe-route-hints.js";

describe("deriveIsWorldReadable", () => {
  it("returns false for null/undefined/non-array", () => {
    expect(deriveIsWorldReadable(null)).toBe(false);
    expect(deriveIsWorldReadable(undefined)).toBe(false);
    expect(deriveIsWorldReadable("string")).toBe(false);
    expect(deriveIsWorldReadable({})).toBe(false);
  });

  it("returns false for empty entries array", () => {
    expect(deriveIsWorldReadable([])).toBe(false);
  });

  it("returns true when app.public.access enable:true is present", () => {
    expect(deriveIsWorldReadable([{ type: "app.public.access", enable: true }])).toBe(true);
  });

  it("returns false when app.public.access enable:false", () => {
    expect(deriveIsWorldReadable([{ type: "app.public.access", enable: false }])).toBe(false);
  });

  it("returns true when app.request has autoAcceptRole", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true, autoAcceptRole: "viewer" }])).toBe(true);
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true, autoAcceptRole: "editor" }])).toBe(true);
  });

  it("returns false when app.request enable:true but no autoAcceptRole", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true }])).toBe(false);
  });

  it("returns false when app.request has autoAcceptRole but enable:false", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: false, autoAcceptRole: "viewer" }])).toBe(false);
  });

  it("latest entry wins — false overrides earlier true for publicAccess", () => {
    expect(
      deriveIsWorldReadable([
        { type: "app.public.access", enable: true },
        { type: "app.public.access", enable: false },
      ])
    ).toBe(false);
  });

  it("latest entry wins — true overrides earlier false for publicAccess", () => {
    expect(
      deriveIsWorldReadable([
        { type: "app.public.access", enable: false },
        { type: "app.public.access", enable: true },
      ])
    ).toBe(true);
  });

  it("ignores unrelated entry types", () => {
    expect(
      deriveIsWorldReadable([
        { type: "active.title", title: "My App" },
        { type: "active.theme", theme: "dark" },
      ])
    ).toBe(false);
  });
});
