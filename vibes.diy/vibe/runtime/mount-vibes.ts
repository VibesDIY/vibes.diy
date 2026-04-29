import React, { Fragment, FunctionComponent } from "react";
import { type Root, createRoot } from "react-dom/client";
import { type } from "arktype";
import { vibeMountParams } from "./vibe.js";
import { VibeContextProvider } from "./VibeContext.js";

let activeRoot: Root | undefined;
let activeProps: unknown;

export function unmountVibe(): void {
  if (activeRoot) {
    activeRoot.unmount();
    activeRoot = undefined;
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
  // Reuse the existing root when present so React can diff the new tree
  // against the live one. If the new render fails (e.g. a component throws
  // during initial render), React keeps the previously-committed DOM rather
  // than blanking the iframe — important for hot-swap during streaming when
  // the resolver may briefly produce broken intermediate code.
  if (activeRoot === undefined) {
    activeRoot = createRoot(element[0]);
  }
  activeProps = iprops;

  const vibeElement = React.createElement(Fragment, null, ...comps.map((Comp, index) => React.createElement(Comp, { key: index })));
  const providerElement = React.createElement(VibeContextProvider, {
    mountParams: { ...props },
    children: vibeElement,
  });
  activeRoot.render(providerElement);
}
