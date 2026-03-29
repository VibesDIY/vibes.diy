import { describe, expect, it } from "vitest";
import { resolveModel } from "../svc/public/resolve-model.js";

describe("resolveModel", () => {
  const defaults = { serverDefaultModel: "default/model" };

  describe("creation mode", () => {
    it("prompt model wins", () => {
      expect(
        resolveModel({
          mode: "creation",
          promptModel: "prompt",
          appCodegenModel: "app",
          userCodegenModel: "user",
          ...defaults,
        })
      ).toBe("prompt");
    });

    it("falls back to app codegen", () => {
      expect(resolveModel({ mode: "creation", appCodegenModel: "app", userCodegenModel: "user", ...defaults })).toBe("app");
    });

    it("falls back to user codegen", () => {
      expect(resolveModel({ mode: "creation", userCodegenModel: "user", ...defaults })).toBe("user");
    });

    it("falls back to server default", () => {
      expect(resolveModel({ mode: "creation", ...defaults })).toBe("default/model");
    });

    it("does NOT use runtime model", () => {
      expect(resolveModel({ mode: "creation", serverRuntimeModel: "runtime", ...defaults })).toBe("default/model");
    });

    it("does NOT use owner runtime model", () => {
      expect(resolveModel({ mode: "creation", ownerRuntimeModel: "owner-rt", ...defaults })).toBe("default/model");
    });
  });

  describe("application mode", () => {
    it("prompt model wins", () => {
      expect(
        resolveModel({
          mode: "application",
          promptModel: "prompt",
          appRuntimeModel: "app",
          ownerRuntimeModel: "owner",
          serverRuntimeModel: "server-rt",
          ...defaults,
        })
      ).toBe("prompt");
    });

    it("falls back to app runtime", () => {
      expect(
        resolveModel({
          mode: "application",
          appRuntimeModel: "app",
          ownerRuntimeModel: "owner",
          serverRuntimeModel: "server-rt",
          ...defaults,
        })
      ).toBe("app");
    });

    it("falls back to owner runtime", () => {
      expect(resolveModel({ mode: "application", ownerRuntimeModel: "owner", serverRuntimeModel: "server-rt", ...defaults })).toBe(
        "owner"
      );
    });

    it("falls back to server runtime model", () => {
      expect(resolveModel({ mode: "application", serverRuntimeModel: "server-rt", ...defaults })).toBe("server-rt");
    });

    it("falls back to server default", () => {
      expect(resolveModel({ mode: "application", ...defaults })).toBe("default/model");
    });

    it("does NOT use app codegen model", () => {
      expect(resolveModel({ mode: "application", appCodegenModel: "codegen", ...defaults })).toBe("default/model");
    });

    it("does NOT use user codegen model", () => {
      expect(resolveModel({ mode: "application", userCodegenModel: "codegen", ...defaults })).toBe("default/model");
    });
  });
});
