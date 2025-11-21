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
    react: "https://esm.sh/react@>=19.1.0",
    "react-dom": "https://esm.sh/react-dom@>=19.1.0",
    "react-dom/client": "https://esm.sh/react-dom@>=19.1.0/client",
    "use-fireproof": "https://esm.sh/use-vibes@0.16.2",
    "call-ai": "https://esm.sh/call-ai@0.16.2",
    "use-vibes": "https://esm.sh/use-vibes@0.16.2",
    "https://esm.sh/use-fireproof": "https://esm.sh/use-vibes@0.16.2",
    eruda: "https://esm.sh/eruda",
    three: "https://esm.sh/three",
    react: "https://esm.sh/react",
    "react-dom": "https://esm.sh/react-dom",
    "react-dom/client": "https://esm.sh/react-dom/client",
    "react/jsx-runtime": "https://esm.sh/react/jsx-runtime",
    "use-fireproof": "https://esm.sh/use-vibes",
    "call-ai": "https://esm.sh/call-ai",
    "use-vibes": "https://esm.sh/use-vibes",
    "https://esm.sh/use-fireproof": "https://esm.sh/use-vibes",
    "https://esm.sh/use-vibes": "https://esm.sh/use-vibes", // self-mapping for consistency
  },
};
