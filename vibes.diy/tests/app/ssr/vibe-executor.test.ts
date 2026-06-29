// Slice 2 (#2802): VIBES_SSR flag + executor selection.
//
// Pure factory — no route wiring yet (that's slice 4). Default is `off` so SSR
// stays dark until the Worker Loader binding is GA (see design Risks section).

import { describe, it, expect } from "vitest";
import { parseVibesSsrMode, selectExecutor } from "../../../vibe/runtime/vibe-executor.js";
import { NodeExecutor } from "../../../vibe/runtime/node-executor.js";
import { WorkerLoaderExecutor, type WorkerLoaderBinding } from "../../../vibe/runtime/worker-loader-executor.js";

const fakeBinding: WorkerLoaderBinding = {
  get() {
    return { getEntrypoint: () => ({ fetch: async () => new Response("") }) };
  },
};

describe("parseVibesSsrMode", () => {
  it("recognizes the three valid modes", () => {
    expect(parseVibesSsrMode("off")).toBe("off");
    expect(parseVibesSsrMode("node")).toBe("node");
    expect(parseVibesSsrMode("loader")).toBe("loader");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(parseVibesSsrMode("  NODE ")).toBe("node");
  });

  it("defaults unknown/undefined to off", () => {
    expect(parseVibesSsrMode(undefined)).toBe("off");
    expect(parseVibesSsrMode("")).toBe("off");
    expect(parseVibesSsrMode("garbage")).toBe("off");
  });
});

describe("selectExecutor", () => {
  it("off ⇒ no executor (SSR disabled)", () => {
    expect(selectExecutor("off")).toBeUndefined();
  });

  it("node ⇒ NodeExecutor", () => {
    expect(selectExecutor("node")).toBeInstanceOf(NodeExecutor);
  });

  it("loader ⇒ WorkerLoaderExecutor when a binding is supplied", () => {
    expect(selectExecutor("loader", { loader: fakeBinding })).toBeInstanceOf(WorkerLoaderExecutor);
  });

  it("loader without a binding throws (binding is required at the edge)", () => {
    expect(() => selectExecutor("loader")).toThrow(/loader/i);
  });
});
