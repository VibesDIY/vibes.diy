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

describe("upNextSets — only the next slot, not the rest of the festival", () => {
  const now = at("2026-08-01T19:30:00");
  const events = [
    ev("A", "2026-08-01T19:00:00", "2026-08-01T20:00:00"), // playing now
    ev("A", "2026-08-01T20:00:00", "2026-08-01T21:00:00"), // up next #1
    ev("A", "2026-08-01T21:00:00", "2026-08-01T22:00:00"), // up next #2
    ev("A", "2026-08-01T22:00:00", "2026-08-01T23:00:00"), // 3rd — over per-venue cap
    ev("B", "2026-08-01T19:30:00", "2026-08-01T20:30:00"), // playing now
    ev("B", "2026-08-01T20:30:00", "2026-08-01T21:30:00"), // up next
    ev("C", "2026-08-02T00:30:00", "2026-08-02T01:30:00"), // far future (next day) — excluded
  ];
  const next = upNextSets(events, now);

  it("caps at two upcoming sets per venue", () => {
    const aTimes = next.filter((e) => e.venueTitle === "A").map((e) => e.start);
    expect(aTimes).toEqual(["2026-08-01T20:00:00", "2026-08-01T21:00:00"]); // not the 22:00 one
  });
  it("drops a venue whose next set is hours away (into the next day)", () => {
    expect(next.some((e) => e.venueTitle === "C")).toBe(false);
  });
  it("never lists a currently-playing set as up next", () => {
    expect(next.some((e) => e.start === "2026-08-01T19:00:00")).toBe(false);
    expect(next.some((e) => e.start === "2026-08-01T19:30:00")).toBe(false);
  });
  it("returns the near-term sets sorted by start", () => {
    expect(next.map((e) => e.start)).toEqual([
      "2026-08-01T20:00:00", // A
      "2026-08-01T20:30:00", // B
      "2026-08-01T21:00:00", // A
    ]);
  });
});
