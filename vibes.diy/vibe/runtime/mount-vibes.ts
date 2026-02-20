import React, { Fragment, FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { type } from "arktype";
import { vibeMountParams } from "./vibe.js";
import { VibeContextProvider } from "./VibeContext.jsx";
import { HiddenMenuWrapper, VibesPanel } from "@vibes.diy/base";

// runs on client side
export function mountVibe(
  comps: FunctionComponent[],
  iprops: unknown // should be VibesDiyMountParams
) {
  // // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // (globalThis as any)[Symbol.for("FP_PRESET_ENV")] = {
  //   FP_DEBUG: "*",
  //   FP_STACK: "true",
  // };
  // console.log("mountVibe", comps, iprops, "FP-DEBUG");

  const props = vibeMountParams(iprops);
  if (props instanceof type.errors) {
    throw new Error(`Invalid mount params: ${props.summary}`);
  }
  const element = document.getElementsByClassName("vibe-app-container");
  if (!element || element.length !== 1) {
    throw new Error(`Can't find the dom element root`);
  }
  const root = createRoot(element[0]);
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
