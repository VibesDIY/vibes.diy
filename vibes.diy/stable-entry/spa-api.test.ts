import { describe, expect, it } from "vitest";
import { handleSpaApi } from "./spa-api.js";

describe("handleSpaApi", () => {
  describe("handlePut", () => {
    it("returns 400 when body is not valid JSON", async () => {
      const request = new Request("https://example.com/__vibes-spa-api__", {
        method: "PUT",
        body: "not json",
        headers: { "Content-Type": "application/json" },
      });
      const response = await handleSpaApi(request, {} as any);
      expect(response.status).toBe(400);
    });

    it("returns 400 when body is missing path field", async () => {
      const request = new Request("https://example.com/__vibes-spa-api__", {
        method: "PUT",
        body: JSON.stringify({ key: "some-key" }),
        headers: { "Content-Type": "application/json" },
      });
      const response = await handleSpaApi(request, {} as any);
      expect(response.status).toBe(400);
    });

    it("returns 400 when body is missing key field", async () => {
      const request = new Request("https://example.com/__vibes-spa-api__", {
        method: "PUT",
        body: JSON.stringify({ path: "/some/path" }),
        headers: { "Content-Type": "application/json" },
      });
      const response = await handleSpaApi(request, {} as any);
      expect(response.status).toBe(400);
    });

    it("returns 400 when body is empty object", async () => {
      const request = new Request("https://example.com/__vibes-spa-api__", {
        method: "PUT",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
      const response = await handleSpaApi(request, {} as any);
      expect(response.status).toBe(400);
    });

    it("returns 303 redirect when body is valid", async () => {
      const request = new Request("https://example.com/__vibes-spa-api__", {
        method: "PUT",
        body: JSON.stringify({ path: "/some/path", key: "some-key" }),
        headers: { "Content-Type": "application/json" },
      });
      const response = await handleSpaApi(request, {} as any);
      expect(response.status).toBe(303);
    });
  });
});

