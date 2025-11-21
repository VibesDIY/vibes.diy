/**
 * Single source of truth for all importmap definitions
 * Used by: root.tsx, eject-template.ts, hosting packages
 */

const VIBES_VERSION = "0.17.5";

export function getLibraryImportMap() {
  return {
    react: "https://esm.sh/react",
    "react-dom": "https://esm.sh/react-dom",
    "react-dom/client": "https://esm.sh/react-dom/client",
    "react/jsx-runtime": "https://esm.sh/react/jsx-runtime",
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
