// Slice B1 (#2856): BACKEND_JS flag + backend executor selection.
//
// Pure factory — no DO, routing, or live binding (those are later slices).
// Default is `off` so backend.js stays dark until the Worker Loader binding is
// GA. Mirrors the SSR `vibe-executor.test.ts` shape.

import { describe, it, expect } from "vitest";
import { parseBackendJsMode, selectBackendExecutor } from "../../../vibe/runtime/backend-executor.js";
import { WorkerLoaderBackendExecutor } from "../../../vibe/runtime/backend-worker-loader-executor.js";
import { type WorkerLoaderBinding } from "../../../vibe/runtime/worker-loader-executor.js";

const fakeBinding: WorkerLoaderBinding = {
  get() {
    return { getEntrypoint: () => ({ fetch: async () => new Response("") }) };
  },
};

describe("parseBackendJsMode", () => {
  it("recognizes the two valid modes", () => {
    expect(parseBackendJsMode("off")).toBe("off");
    expect(parseBackendJsMode("loader")).toBe("loader");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseBackendJsMode("  LOADER ")).toBe("loader");
  });

  it("defaults unknown/undefined/empty to off", () => {
    expect(parseBackendJsMode(undefined)).toBe("off");
    expect(parseBackendJsMode("")).toBe("off");
    expect(parseBackendJsMode("garbage")).toBe("off");
    // there is intentionally no `node` mode — in-process execution is never allowed.
    expect(parseBackendJsMode("node")).toBe("off");
  });
});

describe("selectBackendExecutor", () => {
  it("off ⇒ no executor (backend.js disabled)", () => {
    expect(selectBackendExecutor("off")).toBeUndefined();
  });

  it("loader ⇒ WorkerLoaderBackendExecutor when a binding is supplied", () => {
    expect(selectBackendExecutor("loader", { loader: fakeBinding })).toBeInstanceOf(WorkerLoaderBackendExecutor);
  });

  it("loader without a binding throws (binding is required at the edge)", () => {
    expect(() => selectBackendExecutor("loader")).toThrow(/loader/i);
  });

  it("forwards policyVersion to the executor", async () => {
    const exec = selectBackendExecutor("loader", { loader: fakeBinding, policyVersion: "v9" });
    expect(exec).toBeInstanceOf(WorkerLoaderBackendExecutor);
  });
});
