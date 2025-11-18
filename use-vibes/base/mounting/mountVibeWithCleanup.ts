import { mountVibeCode } from './mountVibeCode.js';
import { isVibesMountReadyEvent, isVibesMountErrorEvent, type MountResult } from './types.js';

// Helper to mount vibe code and return cleanup function and outcome
// Uses three-tier approach: success event, error event, timeout fallback
export async function mountVibeWithCleanup(
  code: string,
  containerId: string,
  titleId: string,
  installId: string,
  transformImports: (code: string) => string
): Promise<MountResult> {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanupScriptElement = () => {
      const script = document.getElementById(`vibe-script-${containerId}`);
      if (script) {
        script.remove();
      }
    };

    // Cleanup function to remove all listeners and timers
    const cleanup = () => {
      document.removeEventListener('vibes-mount-ready', handleMountReady);
      document.removeEventListener('vibes-mount-error', handleMountError);
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Single resolution function to prevent multiple resolutions
    const resolveOnce = (unmount: () => void, outcome: MountResult['outcome']) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ unmount, outcome });
    };

    // Tier 1: Success event handler
    const handleMountReady = (event: Event) => {
      if (!isVibesMountReadyEvent(event)) return;

      const { unmount, containerId: eventContainerId } = event.detail;
      if (eventContainerId === containerId) {
        console.log(`[Vibe Lifecycle] Mount succeeded: ${containerId}`);
        resolveOnce(unmount, 'success');
      }
    };

    // Tier 2: Error event handler
    const handleMountError = (event: Event) => {
      if (!isVibesMountErrorEvent(event)) return;

      const { error, containerId: eventContainerId } = event.detail;
      if (eventContainerId === containerId) {
        console.error(`[Vibe Lifecycle] Mount failed: ${error}`);
        cleanupScriptElement();
        resolveOnce(() => {
          // No-op cleanup - mount never succeeded
        }, 'error');
      }
    };

    // Tier 3: Timeout fallback (5 seconds)
    timeoutId = setTimeout(() => {
      if (!resolved) {
        console.warn(
          `[Vibe Lifecycle] Mount timeout after 5s: ${containerId}. ` +
            `Neither success nor error event received.`
        );
        cleanupScriptElement();
        resolveOnce(() => {
          // No-op cleanup - unknown state
        }, 'timeout');
      }
    }, 5000);

    // Register event listeners
    document.addEventListener('vibes-mount-ready', handleMountReady);
    document.addEventListener('vibes-mount-error', handleMountError);

    // Mount the vibe
    mountVibeCode(code, containerId, titleId, installId, transformImports).catch((err) => {
      // Babel/transform errors - caught before module execution
      console.error('[Vibe Lifecycle] Pre-execution error:', err);
      cleanupScriptElement();
      resolveOnce(() => {
        // No-op cleanup
      }, 'error');
    });
  });
}
