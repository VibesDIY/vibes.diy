import { describe, expect, it } from "vitest";
import { parseLandingLine } from "../logpush-etl/parse-landing.js";

const TS = "2026-05-22T10:00:00Z";

describe("parseLandingLine", () => {
  it("parses a valid [landing] line with a space-bearing UA tail", () => {
    const msg =
      "[landing] https://vibes.diy/vibe/og/foo?fbclid=AAA&utm_campaign=direct-app-foo /vibe/og/foo Mozilla/5.0 (iPhone; CPU) Safari";
    const row = parseLandingLine(msg, TS, "le-1", 3);
    expect(row).toEqual({
      logKey: "le-1",
      lineIdx: 3,
      ts: TS,
      landHref: "https://vibes.diy/vibe/og/foo?fbclid=AAA&utm_campaign=direct-app-foo",
      landHost: "vibes.diy",
      landPath: "/vibe/og/foo",
      fbclid: "AAA",
      utmCampaign: "direct-app-foo",
      ua: "Mozilla/5.0 (iPhone; CPU) Safari",
    });
  });

  it("stores empty utm_campaign when absent", () => {
    const msg = "[landing] https://vibes.diy/vibe/og/foo?fbclid=BBB /vibe/og/foo curl/8";
    const row = parseLandingLine(msg, TS, "le-1", 0);
    expect(row?.utmCampaign).toBe("");
    expect(row?.fbclid).toBe("BBB");
  });

  it("returns null when fbclid is missing", () => {
    const msg = "[landing] https://vibes.diy/vibe/og/foo?utm_campaign=direct-app-foo /vibe/og/foo UA";
    expect(parseLandingLine(msg, TS, "le-1", 0)).toBeNull();
  });

  it("returns null for a junk URL token (no fbclid)", () => {
    const msg = "[landing] not-a-url /vibe/og/foo UA";
    expect(parseLandingLine(msg, TS, "le-1", 0)).toBeNull();
  });

  it("returns null for a non-http URL carrying fbclid (must not throw)", () => {
    const msg = "[landing] ftp://x/p?fbclid=ZZZ&utm_campaign=c /vibe/og/foo SomeUA";
    expect(parseLandingLine(msg, TS, "le-1", 0)).toBeNull();
  });

  it("returns null when the line does not match the prefix shape", () => {
    expect(parseLandingLine("[referer] https://x/ GET /y", TS, "le-1", 0)).toBeNull();
  });
});
