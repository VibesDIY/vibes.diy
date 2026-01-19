/**
 * Clerk authentication and vibe mounting script
 * This is injected into vibe.tsx as inline JavaScript
 */
import React, { FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { VibeContextProvider } from "@vibes.diy/use-vibes-base";
import { MountVibeParams } from "@vibes.diy/use-vibes-base/contexts/VibeContext.js";

// Extract titleId and installId from URL path
// Format: /vibe/:titleId/:installId
// function extractVibeMetadata(): {
//   titleId: string;
//   installId: string;
// } | null {
//   const pathParts = window.location.pathname.split("/").filter(Boolean);
//   const vibeIndex = pathParts.indexOf("vibe");

//   if (vibeIndex !== -1 && pathParts.length > vibeIndex + 2) {
//     const titleId = pathParts[vibeIndex + 1];
//     const installId = pathParts[vibeIndex + 2];
//     return { titleId, installId };
//   }
//   return null;
// }

// runs on client side
export function mountVibe(Vibe: FunctionComponent, props: MountVibeParams) {
  console.log("mountVibe", Vibe, props);
  const element = document.getElementById(props.appSlug);
  if (!element) {
    throw new Error(`Can't find the dom element ${props.appSlug}`);
  }

  // Extract vibe metadata from URL (includes clerkPublishableKey for sync auth)
  // const titleAndInstallId = extractVibeMetadata();

  const root = createRoot(element);
  // Wrap in VibeContextProvider if we have metadata
  // if (titleAndInstallId) {
  const mountParams = { ...props };
  console.log("[mount-vibe] Mounting with vibeMetadata:", mountParams);

  const vibeElement = React.createElement(Vibe);
  const providerElement = React.createElement(VibeContextProvider, {
    mountParams: { ...props },
    children: vibeElement,
  });
  root.render(providerElement);
}
