import { describe, expect, it } from "vitest";
import { ReqResEventoEnDecoder } from "@vibes.diy/api-pkg";

describe("ReqResEventoEnDecoder.encode", () => {
  const encoder = new ReqResEventoEnDecoder();

  it("returns Ok(undefined) for GET requests", async () => {
    const req = new Request("https://example.com/", { method: "GET" });
    const result = await encoder.encode(req);
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBeUndefined();
  });

  it("returns Ok(parsed body) for POST with valid JSON", async () => {
    const req = new Request("https://example.com/", {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
      headers: { "Content-Type": "application/json" },
    });
    const result = await encoder.encode(req);
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toEqual({ hello: "world" });
  });

  it("returns Err for POST with invalid JSON instead of throwing", async () => {
    const req = new Request("https://example.com/", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const result = await encoder.encode(req);
    expect(result.isErr()).toBe(true);
  });

  it("returns Err for PUT with invalid JSON instead of throwing", async () => {
    const req = new Request("https://example.com/", {
      method: "PUT",
      body: "{",
      headers: { "Content-Type": "application/json" },
    });
    const result = await encoder.encode(req);
    expect(result.isErr()).toBe(true);
  });
});
