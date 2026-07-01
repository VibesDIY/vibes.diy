import { describe, it, expect } from "vitest";
import { festivalDayFor, setsOnNow, upNextSets, toFestivalDate } from "./festival-utils.js";

// Everything is anchored through toFestivalDate so events and "now" share one frame.
const at = (s) => toFestivalDate(s).getTime();
const ev = (venueTitle, start, end, eventId = `${venueTitle}-${start}`) => ({ eventId, venueTitle, start, end });

describe("festivalDayFor — 4 AM night cutoff (late-running festival)", () => {
  it("rolls a 1 AM set back to the previous festival day", () => {
    expect(festivalDayFor("2026-08-02T01:00:00")).toBe("Saturday"); // early Sunday → Saturday night
  });
  it("keeps a 5 AM set on its own day", () => {
    expect(festivalDayFor("2026-08-02T05:00:00")).toBe("Sunday");
  });
  it("treats exactly 4:00 AM as the new day, 3:59 as the old", () => {
    expect(festivalDayFor("2026-08-02T04:00:00")).toBe("Sunday");
    expect(festivalDayFor("2026-08-02T03:59:00")).toBe("Saturday");
  });
  it("leaves a normal late-evening set on its day", () => {
    expect(festivalDayFor("2026-08-01T23:00:00")).toBe("Saturday");
  });
});

describe("setsOnNow — playing right now (started, not yet ended)", () => {
  const now = at("2026-08-01T19:45:00");
  const events = [
    ev("A", "2026-08-01T18:45:00", "2026-08-01T20:15:00"), // started an hour ago, still going
    ev("B", "2026-08-01T18:00:00", "2026-08-01T19:00:00"), // already ended
    ev("C", "2026-08-01T20:00:00", "2026-08-01T21:00:00"), // hasn't started
  ];
  it("includes a set that started an hour ago but hasn't ended", () => {
    expect(setsOnNow(events, now).map((e) => e.venueTitle)).toEqual(["A"]);
  });
});

describe("upNextSets — the next wave (anchored on the next set, not the clock)", () => {
  const now = at("2026-08-01T19:30:00");
  const events = [
    ev("A", "2026-08-01T19:00:00", "2026-08-01T20:00:00"), // playing now
    ev("A", "2026-08-01T20:00:00", "2026-08-01T21:00:00"), // up next #1
    ev("A", "2026-08-01T21:00:00", "2026-08-01T22:00:00"), // up next #2
    ev("A", "2026-08-01T22:30:00", "2026-08-01T23:30:00"), // 3rd — over per-venue cap
    ev("B", "2026-08-01T19:30:00", "2026-08-01T20:30:00"), // playing now
    ev("B", "2026-08-01T20:30:00", "2026-08-01T21:30:00"), // up next
    ev("C", "2026-08-02T00:30:00", "2026-08-02T01:30:00"), // a wave away — excluded
  ];
  const next = upNextSets(events, now);

  it("caps at two upcoming sets per venue", () => {
    const aTimes = next.filter((e) => e.venueTitle === "A").map((e) => e.start);
    expect(aTimes).toEqual(["2026-08-01T20:00:00", "2026-08-01T21:00:00"]); // not the 22:30 one
  });
  it("drops a venue whose next set is a whole wave away", () => {
    // next wave anchors on 20:00 (+2h = 22:00), so C at 00:30 is out.
    expect(next.some((e) => e.venueTitle === "C")).toBe(false);
  });
  it("never lists a currently-playing set as up next", () => {
    expect(next.some((e) => e.start === "2026-08-01T19:00:00")).toBe(false);
    expect(next.some((e) => e.start === "2026-08-01T19:30:00")).toBe(false);
  });
  it("returns the wave sorted by start", () => {
    expect(next.map((e) => e.start)).toEqual([
      "2026-08-01T20:00:00", // A
      "2026-08-01T20:30:00", // B
      "2026-08-01T21:00:00", // A
    ]);
  });

  // The behavior the user asked to restore: the opening wave is visible even when the
  // festival is weeks out (anchor on the next set, never on "now").
  it("shows the opening wave a month before the festival", () => {
    const monthBefore = at("2026-07-01T12:00:00");
    const opening = [
      ev("A", "2026-07-30T17:00:00", "2026-07-30T18:00:00"),
      ev("B", "2026-07-30T17:30:00", "2026-07-30T18:30:00"),
      ev("C", "2026-07-30T20:30:00", "2026-07-30T21:30:00"), // later that night — next wave
    ];
    const n = upNextSets(opening, monthBefore);
    expect(n.map((e) => e.venueTitle)).toEqual(["A", "B"]);
    expect(n.some((e) => e.venueTitle === "C")).toBe(false);
  });

  // At the end of a night, "up next" rolls to the next morning's first acts.
  it("rolls to the next morning after the night's last set", () => {
    const lateNight = at("2026-08-01T23:30:00");
    const evs = [
      ev("A", "2026-08-01T22:00:00", "2026-08-01T23:00:00"), // already ended
      ev("D", "2026-08-02T11:00:00", "2026-08-02T12:00:00"), // next morning
      ev("E", "2026-08-02T11:30:00", "2026-08-02T12:30:00"), // next morning
      ev("F", "2026-08-02T15:00:00", "2026-08-02T16:00:00"), // afternoon — next wave
    ];
    const n = upNextSets(evs, lateNight);
    expect(n.map((e) => e.venueTitle)).toEqual(["D", "E"]);
  });
});
