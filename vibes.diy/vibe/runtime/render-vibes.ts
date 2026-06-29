import React, { Fragment, type FunctionComponent, type ReactElement } from "react";
import { type } from "arktype";
import { renderToString } from "react-dom/server";
import { vibeMountParams, type VibeMountParams } from "./vibe.js";
import { VibeContextProvider } from "./VibeContext.js";

/**
 * Build the React tree for a vibe: every component rendered as a sibling inside
 * a single {@link VibeContextProvider}. Shared by {@link renderVibeToString}
 * (server) and `mountVibe` (client) so the server-rendered markup and the markup
 * the client hydrates are identical by construction — a divergence here would
 * make React discard the SSR pass and re-render from scratch, defeating SSR.
 */
export function buildVibeTree(comps: FunctionComponent[], props: VibeMountParams): ReactElement {
  const vibeElement = React.createElement(Fragment, null, ...comps.map((Comp, index) => React.createElement(Comp, { key: index })));
  return React.createElement(VibeContextProvider, {
    mountParams: { ...props },
    children: vibeElement,
  });
}

/**
 * Server-side render of a vibe to an HTML string — the counterpart to
 * `mountVibe`. Runs inside whatever server runtime executes the (already
 * compiled) vibe component(s): a Node/Deno container today, or a Cloudflare
 * Dynamic Worker isolate once the Worker Loader executor lands (see
 * docs/superpowers/specs/2026-06-29-vibe-ssr-dynamic-workers-design.md, #2802).
 *
 * The returned HTML is injected into the `vibe-app-container` element; the
 * client then calls `mountVibe`, which hydrates this markup rather than
 * re-rendering it. Validates `iprops` with the same `vibeMountParams` validator
 * the client uses so server and client agree on the mount context.
 */
export function renderVibeToString(comps: FunctionComponent[], iprops: unknown): string {
  const props = vibeMountParams(iprops);
  if (props instanceof type.errors) {
    throw new Error(`Invalid mount params: ${props.summary}`);
  }
  return renderToString(buildVibeTree(comps, props));
}
