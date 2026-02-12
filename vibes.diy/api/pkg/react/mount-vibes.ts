import React, { Fragment, FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { type } from "arktype";
import { HiddenMenuWrapper } from "./components/HiddenMenuWrapper.jsx";
import { VibesPanel } from "./components/VibesPanel.jsx";
import { VibeContextProvider } from "./VibeContext.jsx";
import { vibesDiyMountParams } from "@vibes.diy/api-types";

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
  const element = document.getElementsByClassName("vibe-app-container");
  if (!element || element.length !== 1) {
    throw new Error(`Can't find the dom element root`);
  }
  const root = createRoot(element[0]);
  // Wrap in VibeContextProvider if we have metadata

  console.log(
    "Mounting vibe with props:",
    comps.map((c) => c)
  );
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
