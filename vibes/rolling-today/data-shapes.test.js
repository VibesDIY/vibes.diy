import { describe, it, expect } from "vitest";
import access from "./access.js";
import { migrateRollingDoc, visibleFavsByRide } from "./friend-utils.js";
import { rideKey } from "./calendar-utils.js";

// access.js either returns an AccessDescriptor or throws { forbidden }. Normalize.
function run(doc, oldDoc, user) {
  try {
    return { ok: access(doc, oldDoc, user, {}) };
  } catch (e) {
    return { forbidden: e.forbidden };
  }
}

describe("migrateRollingDoc (anon local → cloud on sign-in)", () => {
  it("re-keys a favorite onto the signed-in handle", () => {
    expect(migrateRollingDoc({ type: "favorite", rideId: "42", userId: "anonymous" }, "alice")).toEqual({
      type: "favorite",
      rideId: "42",
      userId: "alice",
      _id: "favorite-alice-42",
    });
  });

  it("re-keys a note onto the signed-in handle", () => {
    expect(migrateRollingDoc({ type: "note", rideId: "7", notes: "bring lights" }, "alice")).toEqual({
      type: "note",
      rideId: "7",
      notes: "bring lights",
      userId: "alice",
      _id: "note-alice-7",
    });
  });

  // Regression: legacy geocode docs from the old map must NOT be migrated — pushing
  // them tripped access.js's "unknown document type" guard and spammed error toasts.
  it("drops geocode and any non-favorite/note doc", () => {
    expect(migrateRollingDoc({ type: "geocode", address: "SE 10th" }, "alice")).toBeNull();
    expect(migrateRollingDoc({ type: "whatever" }, "alice")).toBeNull();
  });
});

describe("access.js (channel routing + ownership + guards)", () => {
  it("favorites are public-read, owner-write", () => {
    const { ok } = run({ type: "favorite", userId: "alice", rideId: "1" }, null, { userHandle: "alice" });
    expect(ok.channels).toEqual(["favorites"]);
    expect(ok.grant).toEqual({ public: ["favorites"] });
  });

  it("rejects a favorite written for someone else", () => {
    expect(run({ type: "favorite", userId: "bob", rideId: "1" }, null, { userHandle: "alice" })).toEqual({
      forbidden: "not owner",
    });
  });

  it("notes are private to their owner's channel", () => {
    const { ok } = run({ type: "note", userId: "alice", rideId: "1", notes: "x" }, null, { userHandle: "alice" });
    expect(ok.channels).toEqual(["user-alice"]);
    expect(ok.grant).toEqual({ users: { alice: ["user-alice"] } });
  });

  it("a friend edge is visible to both endpoints", () => {
    const { ok } = run({ type: "friend", userId: "alice", friendSlug: "bob" }, null, { userHandle: "alice" });
    expect(ok.channels).toEqual(["user-alice", "user-bob"]);
    expect(ok.grant).toEqual({ users: { alice: ["user-alice"], bob: ["user-bob"] } });
  });

  it("requires a signed-in user", () => {
    expect(run({ type: "favorite", userId: "alice", rideId: "1" }, null, null)).toEqual({
      forbidden: "authentication required",
    });
  });

  it("routes unknown/legacy types to an unreadable channel (no toast, no failed migration)", () => {
    const { ok } = run({ type: "geocode", userId: "alice" }, null, { userHandle: "alice" });
    expect(ok.channels).toEqual(["discard"]);
    expect(ok.grant).toEqual({}); // no grant → nobody can read it back
  });

  it("uses oldDoc as a fallback for delete tombstones", () => {
    // A delete arrives as a tombstone that may not carry type/userId.
    const { ok } = run({ _id: "favorite-alice-1", _deleted: true }, { type: "favorite", userId: "alice" }, { userHandle: "alice" });
    expect(ok.channels).toEqual(["favorites"]);
  });

  // Security regression: when a doc already exists, its owner is authoritative from
  // oldDoc. An attacker must not be able to overwrite/delete a victim's doc by
  // targeting the victim's _id while spoofing doc.userId to their own handle.
  it("rejects an attacker overwriting a victim's favorite via spoofed doc.userId", () => {
    expect(
      run(
        { _id: "favorite-alice-1", type: "favorite", userId: "attacker", rideId: "1" }, // spoofs own handle
        { type: "favorite", userId: "alice", rideId: "1" }, // real owner
        { userHandle: "attacker" }
      )
    ).toEqual({ forbidden: "not owner" });
  });

  it("rejects an attacker deleting a victim's favorite via spoofed doc.userId", () => {
    expect(
      run(
        { _id: "favorite-alice-1", _deleted: true, userId: "attacker" },
        { type: "favorite", userId: "alice", rideId: "1" },
        { userHandle: "attacker" }
      )
    ).toEqual({ forbidden: "not owner" });
  });

  it("rejects an attacker overwriting a victim's note via spoofed doc.userId", () => {
    expect(
      run(
        { _id: "note-alice-1", type: "note", userId: "attacker", rideId: "1", notes: "pwned" },
        { type: "note", userId: "alice", rideId: "1", notes: "mine" },
        { userHandle: "attacker" }
      )
    ).toEqual({ forbidden: "not owner" });
  });

  it("still lets the real owner update their own existing favorite", () => {
    const { ok } = run(
      { _id: "favorite-alice-1", type: "favorite", userId: "alice", rideId: "1" },
      { type: "favorite", userId: "alice", rideId: "1" },
      { userHandle: "alice" }
    );
    expect(ok.channels).toEqual(["favorites"]);
  });
});

describe("rideKey (per-occurrence, not per-series)", () => {
  it("prefers caldaily_id (the dated occurrence) over id (the series)", () => {
    expect(rideKey({ id: "100", caldaily_id: "100-2026-07-01" })).toBe("100-2026-07-01");
    expect(rideKey({ id: "100", caldaily_id: "100-2026-07-08" })).toBe("100-2026-07-08");
  });

  it("falls back to id when there is no caldaily_id", () => {
    expect(rideKey({ id: 42 })).toBe("42");
  });
});

describe("visibleFavsByRide (friends-only display filter)", () => {
  const favorites = [
    { _id: "f1", type: "favorite", rideId: "1", userId: "me" },
    { _id: "f2", type: "favorite", rideId: "1", userId: "friend" },
    { _id: "f3", type: "favorite", rideId: "1", userId: "stranger" },
    { _id: "f4", type: "favorite", rideId: "2", userId: "friend" },
    { _id: "f5", type: "favorite", userId: "me" }, // no rideId → skipped
  ];
  const visible = new Set(["me", "friend"]);

  it("keeps only you + friends, grouped by ride", () => {
    const byRide = visibleFavsByRide(favorites, visible);
    expect(byRide["1"].map((f) => f.userId).sort()).toEqual(["friend", "me"]); // stranger excluded
    expect(byRide["2"].map((f) => f.userId)).toEqual(["friend"]);
  });

  it("excludes strangers' favorites entirely", () => {
    const byRide = visibleFavsByRide(favorites, visible);
    expect(byRide["1"].some((f) => f.userId === "stranger")).toBe(false);
  });

  it("de-dupes multiple favorites from the same user on one ride", () => {
    const dupes = [
      { _id: "a", rideId: "9", userId: "me" },
      { _id: "b", rideId: "9", userId: "me" },
    ];
    expect(visibleFavsByRide(dupes, new Set(["me"]))["9"]).toHaveLength(1);
  });
});
