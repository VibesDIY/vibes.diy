/**
 * Single source of truth for all importmap definitions
 * Used by: root.tsx, eject-template.ts, hosting packages
 */

const VIBES_VERSION = "0.19.0-dev-stable";

export function getLibraryImportMap() {
  return {
    // Redirect React canary to stable version
    "react@19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",
    "react@^19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",
    "react-dom@19.3.0-canary-fd524fe0-20251121":
      "https://esm.sh/react-dom@19.2.1",
    "react-dom@^19.3.0-canary-fd524fe0-20251121":
      "https://esm.sh/react-dom@19.2.1",
    "https://esm.sh/react@19.3.0-canary-fd524fe0-20251121":
      "https://esm.sh/react@19.2.1",
    "https://esm.sh/react@^19.3.0-canary-fd524fe0-20251121?target=es2022":
      "https://esm.sh/react@19.2.1",
    "https://esm.sh/react@19.3.0-canary-fd524fe0-20251121/es2022/react.mjs":
      "https://esm.sh/react@19.2.1",
    "https://esm.sh/react-dom@19.3.0-canary-fd524fe0-20251121":
      "https://esm.sh/react-dom@19.2.1",
    "https://esm.sh/react-dom@^19.3.0-canary-fd524fe0-20251121?target=es2022":
      "https://esm.sh/react-dom@19.2.1",
    "https://esm.sh/react-dom@19.3.0-canary-fd524fe0-20251121/es2022/react-dom.mjs":
      "https://esm.sh/react-dom@19.2.1",
    react: "https://esm.sh/react@19.2.1",
    "react-dom": "https://esm.sh/react-dom@19.2.1",
    "react-dom/client": "https://esm.sh/react-dom@19.2.1/client",
    "react/jsx-runtime": "https://esm.sh/react@19.2.1/jsx-runtime",
    "use-fireproof": `https://esm.sh/use-vibes@${VIBES_VERSION}`,
    "call-ai": `https://esm.sh/call-ai@${VIBES_VERSION}`,
    "use-vibes": `https://esm.sh/use-vibes@${VIBES_VERSION}`,
    "https://esm.sh/use-fireproof": `https://esm.sh/use-vibes@${VIBES_VERSION}`,
    "https://esm.sh/use-vibes": `https://esm.sh/use-vibes@${VIBES_VERSION}`, // self-mapping for consistency
  };
}

/**
 * Pre-formatted JSON string for direct use in templates
 */
export function getImportMapJson() {
  return JSON.stringify({ imports: getLibraryImportMap() }, null, 2);
}
