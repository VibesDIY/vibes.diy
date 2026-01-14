import { describe, expect, it, vi } from "vitest";
import { toEsmSh } from "vibes-diy-api-svc";

describe("toEsmSh", () => {
  const baseURL = "https://esm.sh/";

  const fetch = async () => {
    return new Response(JSON.stringify({ version: "1.0.0" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  describe("packages with explicit versions", () => {
    it("handles scoped package with version", async () => {
      const result = await toEsmSh(
        ["@scope/package@1.2.3"],
        {},
        baseURL,
        fetch,
      );
      expect(result).toEqual({
        "@scope/package": "https://esm.sh/@scope/package@1.2.3",
      });
    });

    it("handles scoped package with version and subpath", async () => {
      const result = await toEsmSh(
        ["@scope/package@1.2.3/subpath"],
        {},
        baseURL,
        fetch,
      );
      expect(result).toEqual({
        "@scope/package": "https://esm.sh/@scope/package@1.2.3/subpath",
      });
    });

    it("handles unscoped package with version", async () => {
      const result = await toEsmSh(["lodash@4.17.21"], {}, baseURL, fetch);
      expect(result).toEqual({
        lodash: "https://esm.sh/lodash@4.17.21",
      });
    });

    it("handles unscoped package with version and subpath", async () => {
      const result = await toEsmSh(["lodash@4.17.21/fp"], {}, baseURL, fetch);
      expect(result).toEqual({
        lodash: "https://esm.sh/lodash@4.17.21/fp",
      });
    });
  });

  describe("packages without versions (fetches from npm)", () => {
    it("fetches version for scoped package", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "2.0.0" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await toEsmSh(["@babel/core"], {}, baseURL, fetch);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/@babel/core/latest",
      );
      expect(result).toEqual({
        "@babel/core": "https://esm.sh/@babel/core@2.0.0",
      });
    });

    it("fetches version for scoped package with subpath", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "5.0.0" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await toEsmSh(["@scope/pkg/subpath"], {}, baseURL, fetch);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/@scope/pkg/latest",
      );
      expect(result).toEqual({
        "@scope/pkg": "https://esm.sh/@scope/pkg@5.0.0/subpath",
      });
    });

    it("fetches version for unscoped package", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "3.0.0" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await toEsmSh(["react"], {}, baseURL, fetch);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/react/latest",
      );
      expect(result).toEqual({
        react: "https://esm.sh/react@3.0.0",
      });
    });

    it("fetches version for unscoped package with subpath", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "1.0.0" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await toEsmSh(["react/jsx-runtime"], {}, baseURL, fetch);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://registry.npmjs.org/react/latest",
      );
      expect(result).toEqual({
        react: "https://esm.sh/react@1.0.0/jsx-runtime",
      });
    });
  });

  describe("predefined packages", () => {
    it("skips packages that are predefined", async () => {
      const predefined = {
        react: "https://esm.sh/react@19.0.0",
        lodash: "https://esm.sh/lodash@4.17.21",
      };

      const result = await toEsmSh(
        ["react", "lodash"],
        predefined,
        baseURL,
        fetch,
      );

      expect(result).toEqual({});
    });

    it("processes non-predefined packages only", async () => {
      const predefined = {
        react: "https://esm.sh/react@19.0.0",
      };

      const result = await toEsmSh(
        ["react", "axios@1.5.0"],
        predefined,
        baseURL,
        fetch,
      );

      expect(result).toEqual({
        axios: "https://esm.sh/axios@1.5.0",
      });
    });
  });

  describe("error handling", () => {
    it("excludes packages when npm fetch returns non-ok response", async () => {
      const result = await toEsmSh(["nonexistent-package"], {}, baseURL, fetch);

      expect(result).toEqual({});
    });

    it("excludes packages when npm fetch throws", async () => {
      const result = await toEsmSh(["failing-package"], {}, baseURL, fetch);

      expect(result).toEqual({});
    });
  });

  describe("multiple packages", () => {
    it("processes multiple packages with different formats", async () => {
      const result = await toEsmSh(
        ["lodash@4.17.21", "@scope/pkg@2.0.0", "axios"],
        {},
        baseURL,
        fetch,
      );

      expect(result).toEqual({
        lodash: "https://esm.sh/lodash@4.17.21",
        "@scope/pkg": "https://esm.sh/@scope/pkg@2.0.0",
        axios: "https://esm.sh/axios@1.0.0",
      });
    });
  });

  describe("custom base URL", () => {
    it("uses custom base URL", async () => {
      const customBaseURL = "https://cdn.example.com/";

      const result = await toEsmSh(
        ["lodash@4.17.21"],
        {},
        customBaseURL,
        fetch,
      );

      expect(result).toEqual({
        lodash: "https://cdn.example.com/lodash@4.17.21",
      });
    });
  });
});
