/**
 * Library import map for hosting package
 *
 * IMPORTANT: Keep this in sync with the canonical source:
 * /vibes.diy/pkg/app/config/import-map.ts
 *
 * This file maintains the same structure for hosting compatibility
 * and is consumed by appRenderer.ts for dynamic importmap generation.
 */
export const libraryImportMap = {
  imports: {
    eruda: "https://esm.sh/eruda",
    three: "https://esm.sh/three",
    react: "https://esm.sh/react",
    "react-dom": "https://esm.sh/react-dom",
    "react-dom/client": "https://esm.sh/react-dom/client",
    "react/jsx-runtime": "https://esm.sh/react/jsx-runtime",
    "use-fireproof": "https://esm.sh/use-vibes@0.17.4",
    "call-ai": "https://esm.sh/call-ai@0.17.4",
    "use-vibes": "https://esm.sh/use-vibes@0.17.4",
    "https://esm.sh/use-fireproof": "https://esm.sh/use-vibes@0.17.4",
    "https://esm.sh/use-vibes": "https://esm.sh/use-vibes@0.17.4", // self-mapping for consistency
  },
};
