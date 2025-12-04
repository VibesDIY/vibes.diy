import { mountVibesApp } from '../vibe-app-mount.js';
import { useVibesEnv } from '../config/env.js';

// Declare Babel, call-ai, and Vibes globals loaded via CDN script tag or set at runtime
declare global {
  interface Window {
    Babel: {
      transform: (code: string, options: { presets: string[] }) => { code: string | null };
    };
    CALLAI_API_KEY?: string;
    CALLAI_CHAT_URL?: string;
    CALLAI_IMG_URL?: string;
    /**
     * Optional override for the Fireproof Connect API base URL.
     * If unset or empty, `useVibesEnv.VIBES_CONNECT_API_URL` is used.
     */
    VIBES_CONNECT_API_URL?: string;
    /**
     * Optional override for the dashboard token auto endpoint used by toCloud().
     * If unset or empty, `useVibesEnv.VIBES_DASHBOARD_URI` is used.
     */
    VIBES_DASHBOARD_URI?: string;
    /**
     * Optional override for the token/dashboard API base URL.
     * If unset or empty, `useVibesEnv.VIBES_TOKEN_API_URI` is used.
     */
    VIBES_TOKEN_API_URI?: string;
    /**
     * Optional override for the Fireproof cloud base URL (fpcloud protocol).
     * If unset or empty, `useVibesEnv.VIBES_CLOUD_BASE_URL` is used.
     */
    VIBES_CLOUD_BASE_URL?: string;
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
  showVibesSwitch = true,
  apiKey?: string,
  chatUrl?: string,
  imgUrl?: string
): Promise<void> {
  let objectURL: string | undefined;

  try {
    // Set window globals for call-ai if provided
    // This allows call-ai to use these values when no explicit options are provided
    if (typeof window !== 'undefined') {
      // Treat only null/undefined as unset so explicit (even empty) host values are respected
      const isUnset = (value: unknown) => value == null;

      if (apiKey) {
        window.CALLAI_API_KEY = apiKey;
      }

      if (chatUrl) {
        window.CALLAI_CHAT_URL = chatUrl;
      }

      if (imgUrl) {
        window.CALLAI_IMG_URL = imgUrl;
      }

      // Ensure Vibes window overrides are populated for embedded contexts
      if (isUnset(window.VIBES_CONNECT_API_URL)) {
        window.VIBES_CONNECT_API_URL = useVibesEnv.VIBES_CONNECT_API_URL;
      }

      if (isUnset(window.VIBES_DASHBOARD_URI)) {
        window.VIBES_DASHBOARD_URI = useVibesEnv.VIBES_DASHBOARD_URI;
      }

      if (isUnset(window.VIBES_TOKEN_API_URI)) {
        window.VIBES_TOKEN_API_URI = useVibesEnv.VIBES_TOKEN_API_URI;
      }

      if (isUnset(window.VIBES_CLOUD_BASE_URL)) {
        window.VIBES_CLOUD_BASE_URL = useVibesEnv.VIBES_CLOUD_BASE_URL;
      }
    }
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
