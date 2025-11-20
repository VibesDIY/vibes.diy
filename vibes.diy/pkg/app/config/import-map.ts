/**
 * Single source of truth for all importmap definitions
 * Used by: root.tsx, eject-template.ts, hosting packages
 */

export const libraryImportMap = {
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
};

/**
 * Pre-formatted JSON string for direct use in templates
 */
export const importMapJson = JSON.stringify(
  { imports: libraryImportMap },
  null,
  2,
);

/**
 * React-specific imports (subset of libraryImportMap)
 * Used in production builds where React is loaded via CDN
 */
export const reactImports = {
  react: libraryImportMap.react,
  "react-dom": libraryImportMap["react-dom"],
  "react-dom/client": libraryImportMap["react-dom/client"],
  "react/jsx-runtime": libraryImportMap["react/jsx-runtime"],
  "use-fireproof": libraryImportMap["use-fireproof"],
  "call-ai": libraryImportMap["call-ai"],
  "use-vibes": libraryImportMap["use-vibes"],
  "https://esm.sh/use-fireproof":
    libraryImportMap["https://esm.sh/use-fireproof"],
};
