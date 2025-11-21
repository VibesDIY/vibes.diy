import { mountVibesApp } from '../vibe-app-mount.js';

// Declare Babel as a global loaded via CDN script tag
declare global {
  interface Window {
    Babel: {
      transform: (code: string, options: { presets: string[] }) => { code: string | null };
    };
  }
}

// Helper to mount vibe code using Blob URL dynamic import
// With React externalized in vite.config, both the host app and user Vibe code
// use the same React instance from esm.sh via the import map
export async function mountVibeCode(
  code: string,
  containerId: string,
  titleId: string,
  installId: string,
  transformImports: (code: string) => string,
  showVibesSwitch = true
): Promise<void> {
  let objectURL: string | undefined;

  try {
    // Step 1: Transform imports (rewrite unknown bare imports to esm.sh)
    const codeWithTransformedImports = transformImports(code);

    // Step 2: Ensure Babel is loaded (from CDN script tag)
    if (!window.Babel) {
      throw new Error(
        'Babel not loaded - add <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script> to your HTML'
      );
    }

    // Step 3: Transform JSX to JavaScript (preserve ES modules)
    const transformed = window.Babel.transform(codeWithTransformedImports, {
      presets: ['react'], // Only transform JSX, keep imports as-is
    });

    // Step 3: Create Blob URL and dynamically import user's Vibe code
    const blob = new Blob([transformed.code || ''], { type: 'application/javascript' });
    objectURL = URL.createObjectURL(blob);

    // Dynamically import the user's Vibe module
    const userVibeModule = await import(/* @vite-ignore */ objectURL);

    const AppComponent = userVibeModule.default;

    if (typeof AppComponent === 'undefined') {
      throw new Error('App component is not defined - check your default export');
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error('Container element not found: ' + containerId);
    }

    // Step 4: Call the directly imported mountVibesApp with the user's component
    const mountResult = mountVibesApp({
      container: container,
      appComponent: AppComponent,
      showVibesSwitch: showVibesSwitch,
      vibeMetadata: {
        titleId: titleId,
        installId: installId,
      },
    });

    // Dispatch success event with unmount callback
    document.dispatchEvent(
      new CustomEvent('vibes-mount-ready', {
        detail: {
          unmount: mountResult.unmount,
          containerId: containerId,
        },
      })
    );
  } catch (err) {
    console.error('Failed to mount vibe code:', err);
    // Dispatch error event for mount failures
    document.dispatchEvent(
      new CustomEvent('vibes-mount-error', {
        detail: {
          error: err instanceof Error ? err.message : String(err),
          containerId: containerId,
        },
      })
    );
    throw err;
  } finally {
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }
  }
}
