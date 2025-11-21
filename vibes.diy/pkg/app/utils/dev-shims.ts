import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JSX from "react/jsx-runtime";
import * as UseVibes from "use-vibes";
import * as CallAI from "call-ai";

interface VibeWindow extends Window {
  __VIBE_REACT__: typeof React;
  __VIBE_REACT_DOM__: typeof ReactDOM;
  __VIBE_REACT_DOM_CLIENT__: typeof ReactDOMClient;
  __VIBE_REACT_JSX_RUNTIME__: typeof JSX;
  __VIBE_USE_FIREPROOF__: typeof UseVibes; // use-fireproof maps to use-vibes (enhanced version)
  __VIBE_USE_VIBES__: typeof UseVibes;
  __VIBE_CALL_AI__: typeof CallAI;
}

/**
 * In development mode, we want the Vibe (User Code) running in a Blob URL
 * to use the EXACT SAME React instance as the Host App (Vite).
 * This prevents "Hooks can only be called inside of the body of a function component"
 * and "Cannot read properties of null (reading 'useMemo')" errors that occur when
 * two different React instances (one from node_modules via Vite, one from esm.sh) interact.
 *
 * We achieve this by:
 * 1. Exposing the Host App's library instances on global window variables.
 * 2. Transforming the User Code imports to use these window variables instead of URL imports.
 */
export function setupDevShims() {
  if (import.meta.env.DEV) {
    const vibeWindow = window as unknown as VibeWindow;
    vibeWindow.__VIBE_REACT__ = React;
    vibeWindow.__VIBE_REACT_DOM__ = ReactDOM;
    vibeWindow.__VIBE_REACT_DOM_CLIENT__ = ReactDOMClient;
    vibeWindow.__VIBE_REACT_JSX_RUNTIME__ = JSX;
    vibeWindow.__VIBE_USE_FIREPROOF__ = UseVibes; // Map use-fireproof imports to use-vibes (enhanced version)
    vibeWindow.__VIBE_USE_VIBES__ = UseVibes;
    vibeWindow.__VIBE_CALL_AI__ = CallAI;
  }
}

import { getLibraryImportMap } from "../config/import-map.js";

/**
 * Transform bare imports to esm.sh URLs
 * Skips imports that are in the library map, already URLs, or relative paths
 *
 * This is exported separately from transformImportsDev so it can be tested
 * and used without the dev-mode window global replacements.
 */
export function transformImports(code: string): string {
  const importKeys = Object.keys(getLibraryImportMap());
  return code.replace(
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+)?['"]([^'"]+)['"];?/g,
    (match, importPath) => {
      // Don't transform if it's in our library map
      if (importKeys.includes(importPath)) {
        return match;
      }
      // Don't transform if it's already a URL (contains :// or starts with http/https)
      if (importPath.includes("://") || importPath.startsWith("http")) {
        return match;
      }
      // Don't transform relative imports (starting with ./ or ../)
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        return match;
      }
      // Replace the import path with ESM.sh URL
      return match.replace(
        new RegExp(
          `['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`,
        ),
        `"https://esm.sh/${importPath}"`,
      );
    },
  );
}

/**
 * Custom import transformer for development.
 * Rewrites specific package imports to use the global window variables
 * we set up in `setupDevShims`.
 */
export function transformImportsDev(code: string) {
  // First transform bare imports to esm.sh URLs (for both dev and prod)
  let res = transformImports(code);

  if (import.meta.env.DEV) {
    const replacements: Record<string, string> = {
      react: "__VIBE_REACT__",
      "https://esm.sh/react": "__VIBE_REACT__",
      "react-dom": "__VIBE_REACT_DOM__",
      "https://esm.sh/react-dom": "__VIBE_REACT_DOM__",
      "react-dom/client": "__VIBE_REACT_DOM_CLIENT__",
      "https://esm.sh/react-dom/client": "__VIBE_REACT_DOM_CLIENT__",
      "react/jsx-runtime": "__VIBE_REACT_JSX_RUNTIME__",
      "https://esm.sh/react/jsx-runtime": "__VIBE_REACT_JSX_RUNTIME__",
      "use-fireproof": "__VIBE_USE_FIREPROOF__",
      "https://esm.sh/use-fireproof": "__VIBE_USE_FIREPROOF__", // standard transform might map to this
      "https://esm.sh/use-vibes": "__VIBE_USE_VIBES__", // use-fireproof maps to use-vibes in import map often
      "use-vibes": "__VIBE_USE_VIBES__",
      "call-ai": "__VIBE_CALL_AI__",
      "https://esm.sh/call-ai": "__VIBE_CALL_AI__",
    };

    for (const [pkg, varName] of Object.entries(replacements)) {
      // Escape the pkg string for use in Regex (specifically for dots and slashes)
      const escapedPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Handle: import * as X from "pkg"
      res = res.replace(
        new RegExp(
          `import\\s+\\*\\s+as\\s+([a-zA-Z0-9_]+)\\s+from\\s+['"]${escapedPkg}['"];?`,
          "g",
        ),
        `const $1 = window.${varName};`,
      );

      // Handle: import X from "pkg"
      // Use default if available, fallback to module object
      res = res.replace(
        new RegExp(
          `import\\s+([a-zA-Z0-9_]+)\\s+from\\s+['"]${escapedPkg}['"];?`,
          "g",
        ),
        `const $1 = window.${varName}.default || window.${varName};`,
      );

      // Handle: import { X, Y } from "pkg"
      res = res.replace(
        new RegExp(
          `import\\s+\\{([^}]+)}\\s+from\\s+['"]${escapedPkg}['"];?`,
          "g",
        ),
        `const {$1} = window.${varName};`,
      );

      // Handle: import X, { Y } from "pkg"
      res = res.replace(
        new RegExp(
          `import\\s+([a-zA-Z0-9_]+)\\s*,\\s*\\{([^}]+)}\\s+from\\s+['"]${escapedPkg}['"];?`,
          "g",
        ),
        `const $1 = window.${varName}.default || window.${varName}; const {$2} = window.${varName};`,
      );
    }
  }
  return res;
}
