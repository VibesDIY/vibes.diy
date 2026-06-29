import React, { Fragment, type FunctionComponent, type ReactElement } from "react";
import { type VibeMountParams } from "./vibe.js";
import { VibeContextProvider } from "./VibeContext.js";

/**
 * Build the React tree for a vibe: every component rendered as a sibling inside
 * a single {@link VibeContextProvider}. Shared by `renderVibeToString` (server)
 * and `mountVibe` (client) so the server-rendered markup and the markup the
 * client hydrates are identical by construction — a divergence would make React
 * discard the SSR pass and re-render from scratch, defeating SSR.
 *
 * This lives in its own module — separate from `render-vibes.ts` — precisely so
 * the client mount path can share it WITHOUT pulling in `react-dom/server`. The
 * vibe iframe loads this package natively via the generated import map
 * (api/svc/intern/grouped-vibe-import-map.ts), which maps `react-dom` and
 * `react-dom/client` but not `react-dom/server`; a static server import reachable
 * from `mountVibe` would fail native module resolution before hydration starts.
 */
export function buildVibeTree(comps: FunctionComponent[], props: VibeMountParams): ReactElement {
  const vibeElement = React.createElement(Fragment, null, ...comps.map((Comp, index) => React.createElement(Comp, { key: index })));
  return React.createElement(VibeContextProvider, {
    mountParams: { ...props },
    children: vibeElement,
  });
}
