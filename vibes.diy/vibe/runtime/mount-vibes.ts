import { FunctionComponent } from "react";
import { type Root, createRoot, hydrateRoot } from "react-dom/client";
import { type } from "arktype";
import { vibeMountParams } from "./vibe.js";
import { buildVibeTree } from "./render-vibes.js";

let activeRoot: Root | undefined;
let activeProps: unknown;

export function unmountVibe(): void {
  if (activeRoot) {
    // Clear the handle first, then unmount the captured root. If unmount throws
    // — e.g. React tears down a hydration root that hadn't finished hydrating —
    // the module state is still reset, so the next mountVibe starts clean rather
    // than rendering into a detached/broken root.
    const root = activeRoot;
    activeRoot = undefined;
    root.unmount();
  }
}

export function getActiveProps(): unknown {
  return activeProps;
}

// runs on client side
export function mountVibe(
  comps: FunctionComponent[],
  iprops: unknown // should be VibesDiyMountParams
) {
  const props = vibeMountParams(iprops);
  if (props instanceof type.errors) {
    throw new Error(`Invalid mount params: ${props.summary}`);
  }
  const element = document.getElementsByClassName("vibe-app-container");
  if (!element || element.length !== 1) {
    throw new Error(`Can't find the dom element root`);
  }
  activeProps = iprops;

  // Identical tree on server (renderVibeToString) and client, so the markup
  // lines up for hydration.
  const providerElement = buildVibeTree(comps, props);

  if (activeRoot === undefined) {
    const container = element[0];
    // When the container already holds server-rendered markup, hydrate it
    // (reuse the existing DOM) rather than re-rendering from scratch — that's
    // the whole point of SSR. An empty container means client-only render
    // (today's published-vibe path, and live builder sessions). hydrateRoot
    // both creates the root and performs the initial render in one call.
    if (container.hasChildNodes()) {
      activeRoot = hydrateRoot(container, providerElement);
      return;
    }
    activeRoot = createRoot(container);
  }
  // Reuse the existing root when present so React can diff the new tree
  // against the live one. If the new render fails (e.g. a component throws
  // during initial render), React keeps the previously-committed DOM rather
  // than blanking the iframe — important for hot-swap during streaming when
  // the resolver may briefly produce broken intermediate code.
  activeRoot.render(providerElement);
}
