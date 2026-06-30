// Lazy, resilient accessor for the pre-bundled SSR isolate dependency modules
// (#2845 cb2). The actual bundle (`ssr-isolate-deps.generated.js`) is produced at
// build time by scripts/build-ssr-isolate-deps.mjs and is gitignored.
//
// The dynamic import is wrapped so that a MISSING artifact degrades to "no dep
// modules" rather than throwing: that path is only reachable in unit runs that
// import the executor without building (where the fake LOADER binding echoes a
// response and never executes the modules). The LIVE loader route only runs where
// the worker was built (artifact present) AND the beta `env.LOADER` binding
// exists, so production always gets the real modules.

export type SsrIsolateDepModules = Record<string, string>;

export interface SsrIsolateDeps {
  /** Map of isolate import specifier → pre-bundled module source. */
  readonly modules: SsrIsolateDepModules;
  /** React version baked into the bundle — folded into the isolate cache key and parity-checked. */
  readonly reactVersion: string;
}

const EMPTY: SsrIsolateDeps = { modules: {}, reactVersion: "" };

let cached: Promise<SsrIsolateDeps> | undefined;

export function loadSsrIsolateDeps(): Promise<SsrIsolateDeps> {
  if (!cached) {
    cached = import("./ssr-isolate-deps.generated.js")
      .then((m) => ({
        modules: m.SSR_ISOLATE_DEP_MODULES ?? {},
        reactVersion: m.SSR_ISOLATE_REACT_VERSION ?? "",
      }))
      .catch(() => EMPTY);
  }
  return cached;
}
