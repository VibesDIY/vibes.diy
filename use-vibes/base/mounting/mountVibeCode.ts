import * as Babel from '@babel/standalone';

// Helper to mount vibe code directly using its own React instance
export async function mountVibeCode(
  code: string,
  containerId: string,
  titleId: string,
  installId: string,
  transformImports: (code: string) => string,
  showVibesSwitch = true
): Promise<void> {
  try {
    // Step 1: Transform imports (rewrite unknown bare imports to esm.sh)
    const codeWithTransformedImports = transformImports(code);

    // Step 2: Transform JSX to JavaScript (preserve ES modules)
    const transformed = Babel.transform(codeWithTransformedImports, {
      presets: ['react'], // Only transform JSX, keep imports as-is
    });

    // Step 3: Inject mounting code that uses the module's own React/ReactDOM
    // This ensures the component uses the same React instance it imported
    // We alias the imports to avoid collisions with the user's code
    const moduleCode = `
      import __React__ from "https://esm.sh/react";
      import { createRoot as __createRoot__ } from "https://esm.sh/react-dom/client";
      import { mountVibesApp as __mountVibesApp__ } from "https://esm.sh/use-vibes";

      ${transformed.code}

      // Wrap mounting logic in try/catch to emit error events
      try {
        const container = document.getElementById("${containerId}");
        if (!container) {
          throw new Error("Container element not found: ${containerId}");
        }
        if (typeof App === 'undefined') {
          throw new Error("App component is not defined - check your default export");
        }

        // Use mountVibesApp for all cases
        // Note: In preview mode (!showVibesSwitch), the parent container handles
        // layout containment via CSS (isolation: isolate) even if the package version
        // renders full-screen elements.
        const mountResult = __mountVibesApp__({
          container: container,
          appComponent: App,
          showVibesSwitch: ${showVibesSwitch},
          vibeMetadata: {
            titleId: "${titleId}",
            installId: "${installId}",
          },
        });

        // Dispatch success event with unmount callback
        document.dispatchEvent(new CustomEvent('vibes-mount-ready', {
          detail: {
            unmount: mountResult.unmount,
            containerId: "${containerId}"
          }
        }));

      } catch (error) {
        // Dispatch error event for mount failures
        document.dispatchEvent(new CustomEvent('vibes-mount-error', {
          detail: {
            error: error instanceof Error ? error.message : String(error),
            containerId: "${containerId}"
          }
        }));
      }
    `;

    // Step 4: Create and execute module script
    const scriptElement = document.createElement('script');
    scriptElement.type = 'module';
    scriptElement.textContent = moduleCode;
    scriptElement.id = `vibe-script-${containerId}`;

    // Add script to DOM
    document.head.appendChild(scriptElement);

    // Note: The unmount callback will be captured via the vibes-mount-ready event
    // No return value needed here - event listener handles it
  } catch (err) {
    console.error('Failed to mount vibe code:', err);
    throw err;
  }
}
