import { describe, expect, it } from "vitest";
import { buildCapiCompleteRegistration } from "../workers/capi-complete-registration.js";

describe("buildCapiCompleteRegistration", () => {
  it("builds a CompleteRegistration event with fbc from fbclid", () => {
    const fbclidTs = 1700000000000;
    const result = buildCapiCompleteRegistration({
      fbclid: "AbCdEfGhIj",
      fbclidTs,
      capiToken: "tok_reg",
      pixelId: "1310410873948425",
      request: new Request("https://vibes.diy/"),
    });
    const evt = result.data[0];

    expect(evt.event_name).toBe("CompleteRegistration");
    expect(evt.action_source).toBe("website");
    expect(evt.user_data.fbc).toBe(`fb.1.${fbclidTs}.AbCdEfGhIj`);
    expect(result.access_token).toBe("tok_reg");
  });

  it("falls back to current time when fbclidTs is omitted", () => {
    const nowBefore = Date.now();
    const result = buildCapiCompleteRegistration({
      fbclid: "XyZ",
      capiToken: "tok",
      pixelId: "1310410873948425",
      request: new Request("https://vibes.diy/"),
    });
    const nowAfter = Date.now();
    const [, , tsStr] = result.data[0].user_data.fbc.split(".");
    const ts = parseInt(tsStr, 10);
    expect(ts).toBeGreaterThanOrEqual(nowBefore);
    expect(ts).toBeLessThanOrEqual(nowAfter);
  });

  it("includes event_time and event_source_url", () => {
    const nowBefore = Math.floor(Date.now() / 1000);
    const result = buildCapiCompleteRegistration({
      fbclid: "abc",
      capiToken: "tok",
      pixelId: "1310410873948425",
      request: new Request("https://vibes.diy/"),
    });
    const nowAfter = Math.floor(Date.now() / 1000);

    expect(result.data[0].event_time).toBeGreaterThanOrEqual(nowBefore);
    expect(result.data[0].event_time).toBeLessThanOrEqual(nowAfter + 1);
    expect(result.data[0].event_source_url).toBe("https://vibes.diy/");
  });
});
