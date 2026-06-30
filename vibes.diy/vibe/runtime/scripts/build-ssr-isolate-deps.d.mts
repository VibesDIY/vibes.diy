// Types for the build script build-ssr-isolate-deps.mjs (#2845 cb2), so TS
// consumers (the render test) get a typed `buildSsrIsolateDepModules`.
export declare const RENDER_VIBES_KEY: string;
export declare const REACT_KEY: string;
export declare const JSX_RUNTIME_KEY: string;

export declare function buildSsrIsolateDepModules(): Promise<{
  /** React version baked into the bundle. */
  reactVersion: string;
  /** Isolate import specifier → pre-bundled module source. */
  modules: Record<string, string>;
}>;
