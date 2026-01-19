import React, { Fragment, FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { type } from "arktype";
import { HiddenMenuWrapper } from "./components/HiddenMenuWrapper.jsx";
import { VibesPanel } from "./components/VibesPanel.jsx";
import { VibeContextProvider, vibesDiyMountParams } from "@vibes.diy/use-vibes-base";

// runs on client side
export function mountVibe(
  comps: FunctionComponent[],
  iprops: unknown // should be VibesDiyMountParams
) {
  console.log("mountVibe", comps, iprops);
  const props = vibesDiyMountParams(iprops);
  if (props instanceof type.errors) {
    throw new Error(`Invalid mount params: ${props.toLocaleString()}`);
  }
  const element = document.getElementById(props.bindings.appSlug);
  if (!element) {
    throw new Error(`Can't find the dom element ${props.bindings.appSlug}`);
  }
  const root = createRoot(element);
  // Wrap in VibeContextProvider if we have metadata

  const vibeElement = React.createElement(Fragment, null, ...comps.map((Comp, index) => React.createElement(Comp, { key: index })));
  const wrappedVibe = React.createElement(HiddenMenuWrapper, {
    menuContent: React.createElement(VibesPanel),
    showVibesSwitch: true,
    children: vibeElement,
  });
  const providerElement = React.createElement(VibeContextProvider, {
    mountParams: { ...props },
    children: wrappedVibe,
  });
  root.render(providerElement);
}
