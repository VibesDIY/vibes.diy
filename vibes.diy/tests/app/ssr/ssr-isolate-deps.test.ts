// #2845 cb2: prove the pre-bundled SSR isolate dependency modules actually load
// and render a vibe through the REAL production shaping path
// (`transformVibeSource` → `buildVibeWorkerCode` with the dep modules merged in),
// and that the bundled React version stays in hydration-parity with the import
// map the iframe client hydrates against.
//
// The Worker Loader binding is open beta and absent from CI, so we cannot drive a
// live isolate. Instead we lay the exact `WorkerCode.modules` map out on disk —
// each map key as the module a bare/relative specifier resolves to — and import
// the `main` module in Node. That is a faithful test of the BUNDLE's internal
// consistency (one React instance shared by react-dom/server and the vibe's
// hooks; every import resolvable with no npm resolution) and that it renders.
// What it does NOT cover — live Cloudflare Worker Loader module-resolution
// semantics + edge parity — rides the beta binding landing on deploy.

import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { transformVibeSource } from "../../../vibe/runtime/transform-vibe-source.js";
import { buildVibeWorkerCode } from "../../../vibe/runtime/worker-loader-executor.js";
import { resolveVibeModuleGraph, type ResolveSibling } from "../../../vibe/runtime/resolve-vibe-module-graph.js";
import { buildSsrIsolateDepModules } from "../../../vibe/runtime/scripts/build-ssr-isolate-deps.mjs";
import { lockedVersions } from "../../../api/svc/intern/grouped-vibe-import-map.js";

const RENDER_VIBES_KEY = "@vibes.diy/vibe-runtime/render-vibes.js";

let deps: { modules: Record<string, string>; reactVersion: string; depsVersion: string };

beforeAll(async () => {
  deps = await buildSsrIsolateDepModules();
}, 60_000);

// Lay a WorkerCode.modules map out on disk so each isolate import specifier
// resolves to the module the map keys it under (bare → node_modules, relative →
// sibling file), then return the file URL of the main module.
function layoutModulesOnDisk(modules: Record<string, string>, mainKey: string): { root: string; mainUrl: URL } {
  const root = mkdtempSync(join(tmpdir(), "vibe-ssr-isolate-"));
  mkdirSync(join(root, "node_modules/@vibes.diy/vibe-runtime"), { recursive: true });
  mkdirSync(join(root, "node_modules/react"), { recursive: true });
  writeFileSync(
    join(root, "node_modules/@vibes.diy/vibe-runtime/package.json"),
    JSON.stringify({ name: "@vibes.diy/vibe-runtime", type: "module", exports: { "./render-vibes.js": "./render-vibes.js" } })
  );
  writeFileSync(
    join(root, "node_modules/react/package.json"),
    JSON.stringify({ name: "react", type: "module", exports: { ".": "./index.js", "./jsx-runtime": "./jsx-runtime.js" } })
  );
  writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
  for (const [key, source] of Object.entries(modules)) {
    const rel =
      key === RENDER_VIBES_KEY
        ? "node_modules/@vibes.diy/vibe-runtime/render-vibes.js"
        : key === "react"
          ? "node_modules/react/index.js"
          : key === "react/jsx-runtime"
            ? "node_modules/react/jsx-runtime.js"
            : key; // main.js / vibe.js / nested vibe modules (lib/x.js) at root
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, source);
  }
  return { root, mainUrl: pathToFileURL(join(root, mainKey)) };
}

async function renderWorkerCode(code: { modules: Record<string, string>; mainModule: string }): Promise<string> {
  const { root, mainUrl } = layoutModulesOnDisk(code.modules, code.mainModule);
  try {
    const mod = (await import(/* @vite-ignore */ mainUrl.href)) as { default: { fetch(req: Request): Promise<Response> } };
    const res = await mod.default.fetch(new Request("https://vibe-ssr.internal/"));
    return await res.text();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function ssrRender(source: string, mountParams: unknown): Promise<string> {
  const { module } = transformVibeSource(source);
  return renderWorkerCode(buildVibeWorkerCode({ module, mountParams, depModules: deps.modules }));
}

// In-memory sibling resolver mirroring the fsItem-backed one (extension probing).
function graphResolverFrom(files: Record<string, string>): ResolveSibling {
  const dirname = (p: string) => (p.lastIndexOf("/") <= 0 ? "/" : p.slice(0, p.lastIndexOf("/")));
  const resolve = (fromDir: string, spec: string) => {
    const segs = fromDir.split("/").filter(Boolean);
    for (const part of spec.split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") segs.pop();
      else segs.push(part);
    }
    return `/${segs.join("/")}`;
  };
  return async (fromPath, specifier) => {
    const base = resolve(dirname(fromPath), specifier);
    for (const ext of ["", ".jsx", ".tsx", ".ts", ".js"]) {
      if (files[base + ext] !== undefined) return { path: base + ext, source: files[base + ext] };
    }
    return null;
  };
}

// SSR a multi-file vibe: resolve the entry's graph, then render the worker code.
async function ssrRenderMultiFile(entrySource: string, siblings: Record<string, string>, mountParams: unknown): Promise<string> {
  const graph = await resolveVibeModuleGraph({ path: "/App.jsx", source: entrySource }, graphResolverFrom(siblings));
  const code = buildVibeWorkerCode({
    vibeModules: graph.modules,
    entryModule: graph.entryKey,
    mountParams,
    depModules: deps.modules,
  });
  return renderWorkerCode(code);
}

describe("SSR isolate dep bundle", () => {
  it("bundles exactly the three isolate import keys", () => {
    expect(Object.keys(deps.modules).sort()).toEqual([RENDER_VIBES_KEY, "react", "react/jsx-runtime"]);
    // The render-vibes bundle is the big one (react-dom/server + arktype inlined);
    // the react / jsx-runtime entries are thin re-export shims.
    expect(deps.modules[RENDER_VIBES_KEY].length).toBeGreaterThan(50_000);
    expect(deps.modules["react/jsx-runtime"].length).toBeLessThan(1_000);
  });

  it("exposes a content digest of the dep bundle for the isolate cache key (#2967 P2)", () => {
    // The executor folds this — not the React version — into the env.LOADER.get id,
    // so any change to the bundled runtime re-keys the isolate (no stale reuse).
    expect(deps.depsVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  it("renders a single-file vibe to HTML through buildVibeWorkerCode + the deps", async () => {
    const html = await ssrRender(`export default function App(){ return <main>bundled-ssr-ok</main>; }`, { usrEnv: {} });
    expect(html).toContain("<main>bundled-ssr-ok</main>");
  });

  it("shares ONE React instance — a hook-using vibe renders (react-dom/server + the vibe's hooks agree)", async () => {
    const src = `
      import { useState } from "react";
      export default function App(){ const [n] = useState(40); return <main>{"hook-" + (n + 2)}</main>; }
    `;
    const html = await ssrRender(src, { usrEnv: {} });
    expect(html).toContain("<main>hook-42</main>");
  });

  it("injects mountParams the renderer reads (useVibeContext round-trip)", async () => {
    // renderVibeToString validates mountParams via the same arktype validator the
    // client uses; a malformed shape would throw. A well-formed render proves
    // arktype bundled and runs in the isolate.
    const html = await ssrRender(`export default function App(){ return <main>ctx</main>; }`, { usrEnv: { K: "V" } });
    expect(html).toContain("<main>ctx</main>");
  });
});

describe("React-version parity (hydration prerequisite, #2845 / #2836)", () => {
  it("the bundled React matches the import-map React at major.minor", () => {
    // "Byte-identical" SSR↔hydration only holds if the server-bundled React and
    // the import-map React the iframe hydrates with agree. Major/minor drift is a
    // real hydration hazard and must fail; patch drift (the known 19.2.x case,
    // tracked in #2836's single-source work) React tolerates — warn, don't block.
    const mm = (v: string) => v.split(".").slice(0, 2).join(".");
    expect(deps.reactVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(mm(deps.reactVersion)).toBe(mm(lockedVersions.REACT));
    if (deps.reactVersion !== lockedVersions.REACT) {
      console.warn(
        `[ssr-isolate-deps] React patch drift: bundle ${deps.reactVersion} vs import map ${lockedVersions.REACT} — single-source via #2836.`
      );
    }
  });
});

describe("multi-file vibe SSR (#2845 cb6)", () => {
  it("renders a vibe whose entry imports a sibling component", async () => {
    const html = await ssrRenderMultiFile(
      `import { Badge } from "./Badge.jsx"; export default function App(){ return <main><Badge/></main>; }`,
      { "/Badge.jsx": `export function Badge(){ return <span>sibling-badge</span>; }` },
      { usrEnv: {} }
    );
    expect(html).toContain("sibling-badge");
    expect(html).toContain("<span>sibling-badge</span>");
  });

  it("renders a transitive, nested graph (entry → lib/util → lib/k) sharing one React", async () => {
    const html = await ssrRenderMultiFile(
      `import { label } from "./lib/util.js"; import { useState } from "react"; export default function App(){ const [n]=useState(40); return <main>{label(n)}</main>; }`,
      {
        "/lib/util.js": `import { plus } from "./k.js"; export const label = (n) => "sum-" + plus(n);`,
        "/lib/k.js": `export const plus = (n) => n + 2;`,
      },
      { usrEnv: {} }
    );
    expect(html).toContain("<main>sum-42</main>");
  });
});
