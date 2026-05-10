import { describe, expect, it } from "vitest";
import { etagMatches, quoteEtag } from "../svc/public/etag-utils.js";

describe("etag-utils", () => {
  it("quotes ETag values as strong tags", () => {
    expect(quoteEtag("zabc123")).toBe('"zabc123"');
  });

  it("matches exact If-None-Match values", () => {
    expect(etagMatches('"abc"', '"abc"')).toBe(true);
  });

  it("matches comma-separated and weak If-None-Match values", () => {
    expect(etagMatches('"other", W/"abc"', '"abc"')).toBe(true);
  });

  it("supports wildcard If-None-Match", () => {
    expect(etagMatches("*", '"abc"')).toBe(true);
  });

  it("does not match different values", () => {
    expect(etagMatches('"def"', '"abc"')).toBe(false);
  });
});
