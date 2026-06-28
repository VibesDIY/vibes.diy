import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// #2714 Spec B Phase A — QuickJS must load lazily so the worker entrypoint
// module graph stays lean: a shared/reads-only DO that never evaluates an access
// fn must never parse QuickJS, even on a cold-isolate wake that re-runs global
// scope. The empirical finding (recorded in the design doc): a bare dynamic
// import() already code-splits QuickJS into its own chunk under Vite +
// @cloudflare/vite-plugin — no manualChunks / find_additional_modules needed.
//
// Two layers of guard:
//   1. SOURCE INVARIANT (always runs, incl. CI compile_test): a *static value*
//      import of @cf-wasm/quickjs is the only way the glue re-enters the worker
//      entry graph, so we forbid it in the worker source set. This is the
//      regression guard that prevents a future edit from re-inlining QuickJS.
//   2. BUNDLE ASSERTION (runs only when a worker build is present): inspect the
//      real built chunks — entry excludes the QuickJS glue, a lazy chunk holds
//      it. `pnpm check` does NOT build the worker (it is tsc + vitest only), so
//      this layer self-skips there and runs locally / in build & preview jobs
//      where build/vibes_diy_v2/assets exists.

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const CF_SERVE = resolve(REPO_ROOT, "vibes.diy", "api", "svc", "cf-serve.ts");
const BUILD_ASSETS = resolve(__dirname, "..", "build", "vibes_diy_v2", "assets");

const QUICKJS_PKG = "@cf-wasm/quickjs";

// Strip line + block comments before matching so prose containing the word
// "import" can't bridge into a real import statement's `from "..."`.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Matches a statement-level *value* import of the package — `import { x } from
// "@cf-wasm/quickjs"` — but NOT `import type { x } from "..."` (negative
// lookahead on the `type` keyword) and NOT a dynamic `import("...")` (no `from`).
const STATIC_VALUE_IMPORT = /import\s+(?!type\b)[^;]*?from\s+["']@cf-wasm\/quickjs["']/;
// A type-only import statement for the package (allowed — erased at compile).
const TYPE_IMPORT = /import\s+type\s+[^;]*?from\s+["']@cf-wasm\/quickjs["']/;
const DYNAMIC_IMPORT = /import\(\s*["']@cf-wasm\/quickjs["']\s*\)/;

// QuickJS-specific markers in the built glue (unambiguous: emscripten QuickTS
// FFI prefix + the embedded wasm release name). NOT `getQuickJSWASMModule`,
// which legitimately appears once in the entry as the dynamic-import call site.
const GLUE_MARKERS = ["_QTS_", "RELEASE_SYNC"];

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "build") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("worker entrypoint keeps QuickJS lazy (#2714 Spec B Phase A)", () => {
  it("cf-serve.ts imports QuickJS only as a type + a dynamic import()", () => {
    const src = stripComments(readFileSync(CF_SERVE, "utf-8"));
    expect(STATIC_VALUE_IMPORT.test(src), `cf-serve.ts must not statically value-import ${QUICKJS_PKG}`).toBe(false);
    expect(DYNAMIC_IMPORT.test(src), `cf-serve.ts must dynamic-import ${QUICKJS_PKG} at the call site`).toBe(true);
    expect(TYPE_IMPORT.test(src), `cf-serve.ts keeps the type-only import (erased at compile)`).toBe(true);
  });

  it("no worker source statically value-imports QuickJS (the only re-inline path)", () => {
    const sources = [
      ...walkTsFiles(resolve(REPO_ROOT, "vibes.diy", "api", "svc")),
      ...walkTsFiles(resolve(REPO_ROOT, "vibes.diy", "pkg", "workers")),
    ];
    const offenders = sources.filter((f) => STATIC_VALUE_IMPORT.test(stripComments(readFileSync(f, "utf-8"))));
    expect(offenders, `static value-import of ${QUICKJS_PKG} re-inlines it into the entry chunk`).toEqual([]);
  });

  // The lazy import in cf-serve.ts only fires through localInvokeAccessFn, which
  // a DO reaches only if it wires an `invokeAccessFn` override. The vibe/codegen
  // shards do; the shared shard must not — that is why a shared/reads-only
  // instance never triggers the QuickJS import. (Runtime rejection of a vibe-only
  // op arriving on a shared shard is separately enforced by Spec A's shard gate.)
  it("only the vibe + codegen DOs wire the access-fn invoker; the shared DO does not", () => {
    const wires = (f: string): boolean => /invokeAccessFn\s*:/.test(stripComments(readFileSync(f, "utf-8")));
    const WORKERS = resolve(REPO_ROOT, "vibes.diy", "pkg", "workers");
    expect(wires(resolve(WORKERS, "app-sessions.ts")), "AppSessions (vibe) wires invokeAccessFn").toBe(true);
    expect(wires(resolve(WORKERS, "chat-sessions.ts")), "ChatSessions (codegen) wires invokeAccessFn").toBe(true);
    expect(wires(resolve(WORKERS, "shared-sessions.ts")), "SharedSessions must NOT wire invokeAccessFn").toBe(false);
  });
});

// Empirical bundle check — runs only when a worker build exists on disk.
const hasBuild = existsSync(BUILD_ASSETS) && readdirSync(BUILD_ASSETS).some((f) => /^worker-entry-.*\.js$/.test(f));

describe.skipIf(!hasBuild)("built worker bundle splits QuickJS into a lazy chunk", () => {
  // `describe.skipIf` still runs this factory at collection time, so any read of
  // BUILD_ASSETS here must be guarded — in a clean checkout (the `pnpm check` /
  // CI case) the directory does not exist and an unguarded readdirSync throws
  // ENOENT before the suite can skip. Guard on hasBuild; [] when absent.
  const entries = hasBuild ? readdirSync(BUILD_ASSETS).filter((f) => /^worker-entry-.*\.js$/.test(f)) : [];

  it("the entry chunk does not inline the QuickJS glue", () => {
    for (const entry of entries) {
      const txt = readFileSync(resolve(BUILD_ASSETS, entry), "utf-8");
      for (const marker of GLUE_MARKERS) {
        expect(txt.includes(marker), `entry chunk ${entry} must not inline QuickJS glue (${marker})`).toBe(false);
      }
    }
  });

  it("a separate (non-entry) chunk contains the QuickJS glue", () => {
    const others = readdirSync(BUILD_ASSETS).filter((f) => f.endsWith(".js") && !/^worker-entry-/.test(f));
    const someHasGlue = others.some((f) => {
      const txt = readFileSync(resolve(BUILD_ASSETS, f), "utf-8");
      return GLUE_MARKERS.every((m) => txt.includes(m)) || txt.includes("_QTS_");
    });
    expect(someHasGlue, "expected a non-entry chunk to carry the QuickJS glue (split, not dropped)").toBe(true);
  });
});
