import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JSX from "react/jsx-runtime";
import * as UseFireproof from "use-fireproof";
import * as UseVibes from "use-vibes";
import * as CallAI from "call-ai";
import { transformImports } from "@vibes.diy/hosting-base";

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
    (window as any).__VIBE_REACT__ = React;
    (window as any).__VIBE_REACT_DOM__ = ReactDOM;
    (window as any).__VIBE_REACT_DOM_CLIENT__ = ReactDOMClient;
    (window as any).__VIBE_REACT_JSX_RUNTIME__ = JSX;
    (window as any).__VIBE_USE_FIREPROOF__ = UseFireproof;
    (window as any).__VIBE_USE_VIBES__ = UseVibes;
    (window as any).__VIBE_CALL_AI__ = CallAI;
  }
}

/**
 * Custom import transformer for development.
 * Wraps the standard `transformImports` but adds a post-processing step
 * to rewrite specific package imports to use the global window variables
 * we set up in `setupDevShims`.
 */
export function transformImportsDev(code: string) {
  // First run the standard transformation (which might resolve bare specifiers to esm.sh)
  // We need to handle both the original bare specifiers AND the resolved esm.sh URLs
  // because standard transformImports might have already run or might run before this replacement logic depending on implementation.
  // Actually, transformImports returns code with esm.sh URLs.
  // So we should probably run our dev replacement ON TOP of that, targeting both keys.
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
      const escapedPkg = pkg.replace(/[.*+?^${}()|[\\]/g, "\\$& ");

      // Handle: import * as X from "pkg"
      res = res.replace(
        new RegExp(
          `import\\s+\\*\\s+as\\s+([a-zA-Z0-9_]+)\\s+from\\s+['"]${escapedPkg}['"]`;?`,
          "g"
        ),
        `const $1 = window.${varName};`
      );

      // Handle: import X from "pkg"
      // Use default if available, fallback to module object
      res = res.replace(
        new RegExp(
          `import\\s+([a-zA-Z0-9_]+)\\s+from\\s+['"]${escapedPkg}['"]`;?`,
          "g"
        ),
        `const $1 = window.${varName}.default || window.${varName};`
      );

      // Handle: import { X, Y } from "pkg"
      res = res.replace(
        new RegExp(
          `import\\s+\\{([^}]+)\\}'s+from\\s+['"]${escapedPkg}['"]`;?`,
          "g"
        ),
        `const {$1} = window.${varName};`
      );

      // Handle: import X, { Y } from "pkg"
      res = res.replace(
        new RegExp(
          `import\\s+([a-zA-Z0-9_]+)\\s*,\\s*\{([^}]+)\}\s+from\\s+['"]${escapedPkg}['"]`;?`,
          "g"
        ),
        `const $1 = window.${varName}.default || window.${varName}; const {$2} = window.${varName};`
      );
    }
  }
  return res;
}
