import { describe, it, expect } from "vitest";
import { nextSaveState, isSaving, type SaveState } from "../app/hooks/save-state.js";

describe("save-state", () => {
  it("walks the acceptance sequence idle → queued → saving → rebuilt", () => {
    let s: SaveState = "idle";
    s = nextSaveState(s, { type: "request" });
    expect(s).toBe("queued");
    s = nextSaveState(s, { type: "submitted" });
    expect(s).toBe("saving");
    s = nextSaveState(s, { type: "settled" });
    expect(s).toBe("rebuilt");
  });

  it("fails from queued (before submit) and from saving (after submit)", () => {
    expect(nextSaveState("queued", { type: "failed" })).toBe("error");
    expect(nextSaveState("saving", { type: "failed" })).toBe("error");
  });

  it("retries from error back through the sequence", () => {
    let s: SaveState = "error";
    s = nextSaveState(s, { type: "request" });
    expect(s).toBe("queued");
    s = nextSaveState(s, { type: "submitted" });
    expect(s).toBe("saving");
    s = nextSaveState(s, { type: "settled" });
    expect(s).toBe("rebuilt");
  });

  it("reset returns to idle from any terminal state", () => {
    expect(nextSaveState("rebuilt", { type: "reset" })).toBe("idle");
    expect(nextSaveState("error", { type: "reset" })).toBe("idle");
    expect(nextSaveState("saving", { type: "reset" })).toBe("idle");
  });

  it("re-requesting while queued is idempotent", () => {
    expect(nextSaveState("queued", { type: "request" })).toBe("queued");
  });

  it("starts a fresh save after a completed one (rebuilt → queued on a new edit)", () => {
    expect(nextSaveState("rebuilt", { type: "request" })).toBe("queued");
  });

  it("ignores illegal events as no-ops (never wedges)", () => {
    // submit only advances from queued
    expect(nextSaveState("idle", { type: "submitted" })).toBe("idle");
    expect(nextSaveState("saving", { type: "submitted" })).toBe("saving");
    // settle only advances from saving
    expect(nextSaveState("idle", { type: "settled" })).toBe("idle");
    expect(nextSaveState("queued", { type: "settled" })).toBe("queued");
    expect(nextSaveState("rebuilt", { type: "settled" })).toBe("rebuilt");
    // a new request mid-save is ignored (one save at a time)
    expect(nextSaveState("saving", { type: "request" })).toBe("saving");
    // failed only fires from in-flight states
    expect(nextSaveState("idle", { type: "failed" })).toBe("idle");
    expect(nextSaveState("rebuilt", { type: "failed" })).toBe("rebuilt");
  });

  it("isSaving is true only while queued or saving", () => {
    expect(isSaving("idle")).toBe(false);
    expect(isSaving("queued")).toBe(true);
    expect(isSaving("saving")).toBe(true);
    expect(isSaving("rebuilt")).toBe(false);
    expect(isSaving("error")).toBe(false);
  });
});
