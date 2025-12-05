/**
 * Single source of truth for all importmap definitions
 * Used by: hosting worker endpoint, vibes.diy app (root.tsx, eject-template.ts)
 *
 * This configuration is deployed as code to the hosting worker for fast response.
 * Available via HTTPS at: https://vibes.diy/import-map.json
 */

const VIBES_VERSION = "0.19.3-dev-clerk";
const FIREPROOF_VERSION = "0.24.2-dev-clerk";

export function getLibraryImportMap() {
  return {
    // Map React canary versions to stable 19.2.1
    "https://esm.sh/react@19.3.0-canary-fd524fe0-20251121/es2022/react.mjs": "https://esm.sh/react@19.2.1",
    "https://esm.sh/react-dom@%5E19.3.0-canary-fd524fe0-20251121?alias=react:react@19.2.1&target=es2022": "https://esm.sh/react-dom@19.2.1",

    // Core React imports
    react: "https://esm.sh/react@19.2.1",
    "react-dom": "https://esm.sh/react-dom@19.2.1",
    "react-dom/client": "https://esm.sh/react-dom@19.2.1/client",
    "react/jsx-runtime": "https://esm.sh/react@19.2.1/jsx-runtime",

    // Clerk with React aliases
    "@clerk/clerk-react":
      "https://esm.sh/@clerk/clerk-react@5.57.0?alias=react:react@19.2.1&alias=react-dom:react-dom@19.2.1",

    // Fireproof and Vibes with React aliases
    "use-fireproof": `https://esm.sh/use-fireproof@${FIREPROOF_VERSION}?alias=react:react@19.2.1&alias=react-dom:react-dom@19.2.1`,
    "call-ai": `https://esm.sh/call-ai@${VIBES_VERSION}?alias=react:react@19.2.1&alias=react-dom:react-dom@19.2.1`,
    "use-vibes": `https://esm.sh/use-vibes@${VIBES_VERSION}?alias=react:react@19.2.1&alias=react-dom:react-dom@19.2.1`,
    "https://esm.sh/use-fireproof": `https://esm.sh/use-fireproof@${FIREPROOF_VERSION}?alias=react:react@19.2.1&alias=react-dom:react-dom@19.2.1`,
    "https://esm.sh/use-vibes": `https://esm.sh/use-vibes@${VIBES_VERSION}?alias=react:react@19.2.1&alias=react-dom:react-dom@19.2.1`, // self-mapping for consistency
  };
}

/**
 * Pre-formatted JSON string for direct use in templates and HTTP responses
 */
export function getImportMapJson() {
  return JSON.stringify({ imports: getLibraryImportMap() }, null, 2);
}
