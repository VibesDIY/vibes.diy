// Slice 2 (#2802): WorkerLoaderExecutor — Cloudflare Worker Loader path.
//
// The `env.LOADER` binding is open beta and absent from CI, so this never loads
// a live isolate. We test the pure `buildVibeWorkerCode` shaping logic and the
// executor's orchestration (`get → getEntrypoint → fetch`) against a fake LOADER
// binding that echoes a Response.

import { describe, it, expect } from "vitest";
import {
  WorkerLoaderExecutor,
  buildVibeWorkerCode,
  type WorkerLoaderBinding,
} from "../../../vibe/runtime/worker-loader-executor.js";

describe("buildVibeWorkerCode", () => {
  const code = buildVibeWorkerCode({
    module: `export default function App(){ return null; }`,
    mountParams: { usrEnv: {}, accessFnBindings: [{ dbName: "d1", accessFnCid: "cidX" }] },
  });

  it("names a main module that is present in `modules`", () => {
    expect(typeof code.mainModule).toBe("string");
    expect(code.modules[code.mainModule]).toBeTypeOf("string");
  });

  it("deep-imports the slice-1 server renderer (never the package root)", () => {
    const main = code.modules[code.mainModule];
    expect(main).toMatch(/@vibes\.diy\/vibe-runtime\/render-vibes\.js/);
    expect(main).not.toMatch(/from\s+["']@vibes\.diy\/vibe-runtime["']/);
  });

  it("carries the transformed vibe module and JSON mountParams", () => {
    const joined = Object.values(code.modules).join("\n");
    expect(joined).toContain("function App()");
    expect(joined).toContain('"accessFnCid":"cidX"');
  });

  it("exposes a fetch default export that renders HTML", () => {
    const main = code.modules[code.mainModule];
    expect(main).toMatch(/export default/);
    expect(main).toMatch(/fetch/);
    expect(main).toMatch(/renderVibeToString/);
  });

  it("pins globalOutbound to null (no inherited edge network access)", () => {
    // Worker Loader defaults a missing globalOutbound to inheriting the parent
    // worker's network — untrusted vibe code must not get that by omission.
    expect(code.globalOutbound).toBeNull();
  });
});

describe("WorkerLoaderExecutor.render (fake binding)", () => {
  function fakeLoader(): { binding: WorkerLoaderBinding; calls: { id: string; code: unknown }[] } {
    const calls: { id: string; code: unknown }[] = [];
    const binding: WorkerLoaderBinding = {
      get(id, factory) {
        const code = factory();
        calls.push({ id, code });
        return {
          getEntrypoint() {
            return {
              fetch: async () =>
                new Response("<main>fake-isolate-html</main>", {
                  headers: { "content-type": "text/html" },
                }),
            };
          },
        };
      },
    };
    return { binding, calls };
  }

  it("drives get → getEntrypoint → fetch and returns the response text", async () => {
    const { binding } = fakeLoader();
    const exec = new WorkerLoaderExecutor(binding);
    const { html } = await exec.render({
      source: `export default function App(){ return <main>hi</main>; }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("fake-isolate-html");
  });

  it("keys the isolate on a stable content hash (same input ⇒ same id)", async () => {
    const a = fakeLoader();
    const b = fakeLoader();
    const input = {
      source: `export default function App(){ return <main>hi</main>; }`,
      mountParams: { usrEnv: {} },
    };
    await new WorkerLoaderExecutor(a.binding).render(input);
    await new WorkerLoaderExecutor(b.binding).render(input);
    expect(a.calls[0].id).toBe(b.calls[0].id);
    expect(a.calls[0].id.length).toBeGreaterThan(0);
  });

  it("passes a fully-shaped WorkerCode to the loader factory", async () => {
    const { binding, calls } = fakeLoader();
    await new WorkerLoaderExecutor(binding).render({
      source: `export default function App(){ return <main>hi</main>; }`,
      mountParams: { usrEnv: {} },
    });
    const code = calls[0].code as { mainModule: string; modules: Record<string, string> };
    expect(code.modules[code.mainModule]).toMatch(/renderVibeToString/);
  });
});
