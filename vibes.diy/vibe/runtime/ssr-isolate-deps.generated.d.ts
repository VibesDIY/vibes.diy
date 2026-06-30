// Committed type declaration for the GENERATED, gitignored
// `ssr-isolate-deps.generated.js` (#2845 cb2). The `.js` is produced at build
// time by scripts/build-ssr-isolate-deps.mjs; this `.d.ts` lets `tsc` resolve the
// dynamic `import("./ssr-isolate-deps.generated.js")` in ssr-isolate-deps.ts
// without the artifact being present (e.g. on a fresh checkout or in unit tests).
export declare const SSR_ISOLATE_REACT_VERSION: string;
// Content digest over all dep module sources — folded into the isolate cache key
// so any dep-bundle change re-keys the isolate (#2967 Codex P2).
export declare const SSR_ISOLATE_DEPS_VERSION: string;
export declare const SSR_ISOLATE_DEP_MODULES: Record<string, string>;
