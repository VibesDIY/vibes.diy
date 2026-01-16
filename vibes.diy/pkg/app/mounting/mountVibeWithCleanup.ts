// import { ResolveOnce } from "@adviser/cement";
// import { mountVibeCode } from "./mountVibeCode.js";
// import { isVibesMountReadyEvent, isVibesMountErrorEvent } from "./types.js";

// // Helper to mount vibe code and return cleanup function
// // Uses three-tier approach: success event, error event, timeout fallback
// export async function mountVibeWithCleanup(
//   code: string,
//   containerId: string,
//   titleId: string,
//   installId: string,
//   transformImports: (code: string) => string,
//   showVibesSwitch = true,
//   apiKey?: string,
//   chatUrl?: string,
//   imgUrl?: string,
// ): Promise<() => void> {
//   return new Promise<() => void>((resolve) => {
//     const resolveOnce = new ResolveOnce<void>();
//     let timeoutId: ReturnType<typeof setTimeout> | null = null;

//     const cleanup = () => {
//       document.removeEventListener("vibes-mount-ready", handleMountReady);
//       document.removeEventListener("vibes-mount-error", handleMountError);
//       if (timeoutId) clearTimeout(timeoutId);
//     };

//     // Tier 1: Success event handler
//     const handleMountReady = (event: Event) => {
//       if (!isVibesMountReadyEvent(event)) return;

//       const { unmount, containerId: eventContainerId } = event.detail;
//       if (eventContainerId === containerId) {
//         resolveOnce.once(() => {
//           cleanup();
//           resolve(unmount);
//         });
//       }
//     };

//     // Tier 2: Error event handler
//     const handleMountError = (event: Event) => {
//       if (!isVibesMountErrorEvent(event)) return;

//       const { error: _error, containerId: eventContainerId } = event.detail;
//       if (eventContainerId === containerId) {
//         resolveOnce.once(() => {
//           cleanup();
//           resolve(() => {
//             // No-op cleanup - mount never succeeded
//           });
//         });
//       }
//     };

//     // Tier 3: Timeout fallback (5 seconds)
//     timeoutId = setTimeout(() => {
//       resolveOnce.once(() => {
//         cleanup();
//         resolve(() => {
//           // No-op cleanup - unknown state
//         });
//       });
//     }, 5000);

//     // Register event listeners
//     document.addEventListener("vibes-mount-ready", handleMountReady);
//     document.addEventListener("vibes-mount-error", handleMountError);

//     // Mount the vibe
//     mountVibeCode(
//       code,
//       containerId,
//       titleId,
//       installId,
//       transformImports,
//       showVibesSwitch,
//       apiKey,
//       chatUrl,
//       imgUrl,
//     ).catch((_err) => {
//       // Babel/transform errors - caught before module execution
//       resolveOnce.once(() => {
//         cleanup();
//         resolve(() => {
//           // No-op cleanup
//         });
//       });
//     });
//   });
// }
