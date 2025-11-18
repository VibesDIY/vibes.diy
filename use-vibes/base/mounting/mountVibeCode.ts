import * as Babel from '@babel/standalone';
import { normalizeComponentExports } from '@vibes.diy/prompts';

// Helper to mount vibe code directly using its own React instance
export async function mountVibeCode(
  code: string,
  containerId: string,
  titleId: string,
  installId: string,
  transformImports: (code: string) => string
): Promise<void> {
  try {
    // Step 1: Normalize component exports so any valid default-exported component
    // shape ends up as an App symbol we can mount.
    let normalizedCode: string;
    try {
      normalizedCode = normalizeComponentExports(code);
    } catch (error) {
      // Export normalization happens centrally here; surface a targeted error event
      // so the three-tier lifecycle can treat this as a mount failure rather than
      // falling back to a generic timeout.
      document.dispatchEvent(
        new CustomEvent('vibes-mount-error', {
          detail: {
            error:
              error instanceof Error
                ? `export normalization failed: ${error.message}`
                : String(error),
            containerId,
          },
        }),
      );
      return;
    }

    // Step 2: Transform imports (rewrite unknown bare imports to esm.sh).
    // NOTE: `transformImports` is expected to rewrite *imports only*; export
    // normalization is handled exclusively by `normalizeComponentExports` above.
    const codeWithTransformedImports = transformImports(normalizedCode);

    // Step 3: Transform JSX to JavaScript (preserve ES modules)
    const transformed = Babel.transform(codeWithTransformedImports, {
      presets: ['react'], // Only transform JSX, keep imports as-is
    });

    // Step 4: Inject mounting code that uses the module's own React/ReactDOM
    // This ensures the component uses the same React instance it imported
    const moduleCode = `
      import { mountVibesApp } from "use-vibes";

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

        const mountResult = mountVibesApp({
          container: container,
          appComponent: App,
          showVibesSwitch: true,
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

    // Step 5: Create and execute module script
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
