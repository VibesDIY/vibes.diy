// DI harness for vibes-diy-provider.
//
// Under isolate:false a per-file vi.mock("…/vibes-diy-provider.js") bleeds: the
// first file's factory wins the shared module cache, so divergent useVibesDiy
// shapes leak between files (and a global mock can't be used because some tests
// render against the REAL provider). Instead of mocking, tests inject a context
// value through the real (exported) VibesDiyContext — no module mock, no bleed.
import React from "react";
import { VibesDiyContext } from "~/vibes.diy/app/vibes-diy-provider.js";
import type { VibesDiyCtx } from "~/vibes.diy/app/vibes-diy-provider.js";
import { ThemeProvider } from "~/vibes.diy/app/contexts/ThemeContext.js";

/**
 * Returns a wrapper that injects a (partial) VibesDiy context plus the real
 * ThemeProvider, for use as the `wrapper` option of @testing-library/react
 * render()/renderHook(). Replaces module-mocking the provider and ThemeContext.
 */
export function vibesWrapper(ctx: Partial<VibesDiyCtx> | Record<string, unknown>) {
  return function VibesProviderWrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider>
        <VibesDiyContext.Provider value={ctx as VibesDiyCtx}>{children}</VibesDiyContext.Provider>
      </ThemeProvider>
    );
  };
}
