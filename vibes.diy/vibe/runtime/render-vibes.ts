import { type FunctionComponent } from "react";
import { type } from "arktype";
import { renderToString } from "react-dom/server";
import { vibeMountParams } from "./vibe.js";
import { buildVibeTree } from "./vibe-tree.js";

/**
 * Server-side render of a vibe to an HTML string — the counterpart to
 * `mountVibe`. Runs inside whatever server runtime executes the (already
 * compiled) vibe component(s): a Node/Deno container today, or a Cloudflare
 * Dynamic Worker isolate once the Worker Loader executor lands (see
 * docs/superpowers/specs/2026-06-29-vibe-ssr-dynamic-workers-design.md, #2802).
 *
 * Imports `react-dom/server`, so it is intentionally NOT re-exported from the
 * package root (index.ts): the vibe iframe loads this package natively in the
 * browser, where `react-dom/server` is not in the import map. Server callers
 * deep-import this module (`@vibes.diy/vibe-runtime/render-vibes.js`).
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
