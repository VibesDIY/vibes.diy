import { describe, expect, it, vi } from "vitest";
import { toEsmSh } from "@vibes.diy/api-svc";

describe("toEsmSh", () => {
  const baseURL = "https://esm.sh/";

  async function fetchPkgVersion(pkg: string): Promise<string | undefined> {
    if (["failing-package", "nonexistent-package"].includes(pkg)) {
      return;
    }
    return "1.0.0";
  }

  describe("packages with explicit versions", () => {
    it("handles scoped package with version", async () => {
      const result = await toEsmSh(["@scope/package@1.2.3"], {}, baseURL, fetchPkgVersion);
      expect(result).toEqual({
        "@scope/package": "https://esm.sh/@scope/package@1.2.3",
      });
    });

    it("handles scoped package with version and subpath", async () => {
      const result = await toEsmSh(["@scope/package@1.2.3/subpath"], {}, baseURL, fetchPkgVersion);
      expect(result).toEqual({
        "@scope/package": "https://esm.sh/@scope/package@1.2.3/subpath",
      });
    });

    it("handles unscoped package with version", async () => {
      const result = await toEsmSh(["lodash@4.17.21"], {}, baseURL, fetchPkgVersion);
      expect(result).toEqual({
        lodash: "https://esm.sh/lodash@4.17.21",
      });
    });

    it("handles unscoped package with version and subpath", async () => {
      const result = await toEsmSh(["lodash@4.17.21/fp"], {}, baseURL, fetchPkgVersion);
      expect(result).toEqual({
        lodash: "https://esm.sh/lodash@4.17.21/fp",
      });
    });
  });

  describe("packages without versions (fetches from npm)", () => {
    it("fetches version for scoped package", async () => {
      const result = await toEsmSh(["@babel/core"], {}, baseURL, fetchPkgVersion);
      expect(result).toEqual({
        "@babel/core": "https://esm.sh/@babel/core@1.0.0",
      });
    });

    it("fetches version for scoped package with subpath", async () => {
      const result = await toEsmSh(["@scope/pkg/subpath"], {}, baseURL, fetchPkgVersion);

      expect(result).toEqual({
        "@scope/pkg": "https://esm.sh/@scope/pkg@1.0.0/subpath",
      });
    });

    it("fetches version for unscoped package", async () => {
      const result = await toEsmSh(["react"], {}, baseURL, fetchPkgVersion);

      expect(result).toEqual({
        react: "https://esm.sh/react@1.0.0",
      });
    });

    it("fetches version for unscoped package with subpath", async () => {
      const result = await toEsmSh(["react/jsx-runtime"], {}, baseURL, fetchPkgVersion);
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

      const result = await toEsmSh(["react", "lodash"], predefined, baseURL, fetchPkgVersion);

      expect(result).toEqual({});
    });

    it("processes non-predefined packages only", async () => {
      const predefined = {
        react: "https://esm.sh/react@19.0.0",
      };

      const result = await toEsmSh(["react", "axios@1.5.0"], predefined, baseURL, fetchPkgVersion);

      expect(result).toEqual({
        axios: "https://esm.sh/axios@1.5.0",
      });
    });
  });

  describe("error handling", () => {
    it("excludes packages when npm fetch returns non-ok response", async () => {
      const result = await toEsmSh(["nonexistent-package"], {}, baseURL, fetchPkgVersion);

      expect(result).toEqual({});
    });

    it("excludes packages when npm fetch throws", async () => {
      const result = await toEsmSh(["failing-package"], {}, baseURL, fetchPkgVersion);

      expect(result).toEqual({});
    });
  });

  describe("multiple packages", () => {
    it("processes multiple packages with different formats", async () => {
      const result = await toEsmSh(["lodash@4.17.21", "@scope/pkg@2.0.0", "axios"], {}, baseURL, fetchPkgVersion);

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

      const result = await toEsmSh(["lodash@4.17.21"], {}, customBaseURL, fetchPkgVersion);

      expect(result).toEqual({
        lodash: "https://cdn.example.com/lodash@4.17.21",
      });
    });
  });
});
