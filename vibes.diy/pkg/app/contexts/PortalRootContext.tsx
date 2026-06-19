import { createContext, useContext } from "react";

// DI seam for React portals. Components that render via createPortal target
// usePortalRoot() instead of document.body directly. In production the default
// is document.body (unchanged). Tests inject a per-test container so portal DOM
// unmounts deterministically with the test tree — under isolate:false the shared
// document otherwise accumulates portal nodes across files and their cleanup
// races (NotFoundError: removeChild ... not a child of this node).
const PortalRootContext = createContext<HTMLElement | null>(null);

export const PortalRootProvider = PortalRootContext.Provider;

/**
 * Container for portal content; defaults to document.body on the client and
 * null during SSR (where document is undefined). Callers must guard the
 * createPortal() render when this returns null.
 */
export function usePortalRoot(): HTMLElement | null {
  const injected = useContext(PortalRootContext);
  if (injected) return injected;
  return typeof document !== "undefined" ? document.body : null;
}
