/**
 * Clerk authentication and vibe mounting script
 * This is injected into vibe.tsx as inline JavaScript
 */
import React, { FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { VibeContextProvider } from "@vibes.diy/use-vibes-base";

// Extract titleId and installId from URL path
// Format: /vibe/:titleId/:installId
function extractVibeMetadata(clerkPublishableKey: string): {
  titleId: string;
  installId: string;
  clerkPublishableKey: string;
} | null {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const vibeIndex = pathParts.indexOf("vibe");

  if (vibeIndex !== -1 && pathParts.length > vibeIndex + 2) {
    const titleId = pathParts[vibeIndex + 1];
    const installId = pathParts[vibeIndex + 2];
    return { titleId, installId, clerkPublishableKey };
  }

  return null;
}

export function mountVibe(
  Vibe: FunctionComponent,
  props: { appSlug: string; clerkPublishableKey: string },
) {
  console.log("mountVibe", Vibe, props);
  const element = document.getElementById(props.appSlug);
  if (!element) {
    throw new Error(`Can't find the dom element ${props.appSlug}`);
  }

  // Extract vibe metadata from URL (includes clerkPublishableKey for sync auth)
  const vibeMetadata = extractVibeMetadata(props.clerkPublishableKey);

  const root = createRoot(element);

  // Wrap in VibeContextProvider if we have metadata
  if (vibeMetadata) {
    console.log("[mount-vibe] Mounting with vibeMetadata:", vibeMetadata);
    const vibeElement = React.createElement(Vibe);
    const providerElement = React.createElement(VibeContextProvider, {
      metadata: vibeMetadata,
      children: vibeElement,
    });
    root.render(providerElement);
  } else {
    console.warn(
      "[mount-vibe] No vibeMetadata found in URL - mounting without context",
    );
    root.render(React.createElement(Vibe));
  }
}

// export const clerkAuthScript = (
//   clerkPublishableKey: string,
//   transformedJS: string,
// ) => `
// (async function setupClerkAndMountVibe() {
//   try {
//     // Import Clerk JS SDK from importmap
//     const { Clerk } = await import('@clerk/clerk-js');

//     // Initialize Clerk
//     const clerk = new Clerk('${clerkPublishableKey}');
//     await clerk.load();

//     // Dispatch event with Clerk instance for vibe controls
//     window.dispatchEvent(new CustomEvent('clerk-instance-ready', {
//       detail: { clerk }
//     }));

//     // Check authentication
//     if (!clerk.user) {
//       // Not authenticated - redirect to sign-in
//       console.log('Not authenticated, redirecting to sign-in');
//       await clerk.redirectToSignIn({
//         redirectUrl: window.location.href
//       });
//       // Stop execution - redirect in progress
//       return;
//     }

//     // User authenticated - setup token subscription
//     console.log('✅ User authenticated');

//     // Get initial token
//     const token = await clerk.session.getToken();
//     window.CALLAI_API_KEY = token;
//     console.log('✅ Token set:', token ? 'exists' : 'null');

//     // Setup token refresh using Clerk's native listener
//     clerk.addListener(async ({ session }) => {
//       if (session) {
//         try {
//           const freshToken = await session.getToken();
//           window.CALLAI_API_KEY = freshToken;

//           // Dispatch event for use-vibes to subscribe
//           window.dispatchEvent(new CustomEvent('clerk-token-refreshed', {
//             detail: { token: freshToken }
//           }));

//           console.log('✅ Token refreshed');
//         } catch (err) {
//           console.error('❌ Token refresh failed:', err);
//         }
//       }
//     });

//     console.log('✅ Token subscription active');

//     // Auth complete - NOW mount vibe
//     const vibeCode = \`${transformedJS.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;
//     const blob = new Blob([vibeCode], { type: 'application/javascript' });
//     const moduleURL = URL.createObjectURL(blob);

//     // Dynamically import to get default export
//     import(moduleURL).then(async (module) => {
//       const AppComponent = module.default;

//       // Import ReactDOM and mount
//       const ReactDOM = await import('react-dom/client');
//       const root = ReactDOM.createRoot(document.getElementById('vibes.diy'));
//       const React = await import('react');
//       root.render(React.createElement(AppComponent));
//       console.log('✅ Vibe mounted');
//     }).catch(err => {
//       console.error('Failed to mount vibe:', err);
//       document.getElementById('vibes.diy').innerHTML = '<pre>Error loading vibe: ' + err.message + '</pre>';
//     });

//   } catch (error) {
//     console.error('❌ Auth failed:', error);
//     // Show error instead of vibe
//     document.getElementById('vibes.diy').innerHTML =
//       '<div style="padding: 2rem; color: red; font-family: monospace;">Authentication error: ' + error.message + '</div>';
//   }
// })();
// `;
