import React, { useEffect, useState } from "react";
import { MemoryRouter } from "react-router";
import { VibesDiyContext } from "~/vibes.diy/app/vibes-diy-provider.js";
import type { VibesDiyCtx } from "~/vibes.diy/app/vibes-diy-provider.js";
import { ThemeProvider } from "~/vibes.diy/app/contexts/ThemeContext.js";
import { PortalRootProvider } from "~/vibes.diy/app/contexts/PortalRootContext.js";

interface VibesWrapperOptions {
  /** initialEntries for the real MemoryRouter (defaults to ["/"]). */
  initialEntries?: string[];
}

/**
 * Provides a per-test portal container so components that createPortal() mount
 * into an element that unmounts deterministically with the test tree. Under
 * isolate:false the shared document otherwise accumulates portal DOM across
 * files and their cleanup races (removeChild NotFoundError).
 */
export function PortalRootWrapper({ children }: { children: React.ReactNode }) {
  const [root] = useState(() => {
    const el = document.createElement("div");
    el.setAttribute("data-test-portal-root", "");
    return el;
  });
  useEffect(() => {
    document.body.appendChild(root);
    return () => {
      root.remove();
    };
  }, [root]);
  return <PortalRootProvider value={root}>{children}</PortalRootProvider>;
}

/**
 * Returns a wrapper that provides the real MemoryRouter + ThemeProvider + a
 * per-test portal root and injects a (partial) VibesDiy context, for use as the
 * `wrapper` option of @testing-library/react render()/renderHook(). Replaces
 * module-mocking the provider, ThemeContext, and react-router.
 */
export function vibesWrapper(ctx: Partial<VibesDiyCtx> | Record<string, unknown>, options: VibesWrapperOptions = {}) {
  const { initialEntries = ["/"] } = options;
  return function VibesProviderWrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <ThemeProvider>
          <PortalRootWrapper>
            <VibesDiyContext.Provider value={ctx as VibesDiyCtx}>{children}</VibesDiyContext.Provider>
          </PortalRootWrapper>
        </ThemeProvider>
      </MemoryRouter>
    );
  };
}
