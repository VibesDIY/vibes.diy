/**
 * Single source of truth for all importmap definitions
 * Used by: root.tsx, eject-template.ts, hosting packages
 */

import { Lazy } from "@adviser/cement";

const VIBES_VERSION = "0.18.13-dev";

export type ImportMap = Record<string, string>;

/**
 * Lazy-wrapped async function to get import map with optional overrides
 * Caches result automatically via Lazy()
 */
export const getImportmap = Lazy(
  async (overrides: ImportMap = {}): Promise<ImportMap> => {
    const baseMap: ImportMap = {
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

    return { ...baseMap, ...overrides };
  },
);

/**
 * Lazy-wrapped async function to get import map as JSON string
 * Pre-formatted for direct use in templates
 */
export const getImportMapJson = Lazy(
  async (overrides: ImportMap = {}): Promise<string> => {
    const importMap = await getImportmap(overrides);
    return JSON.stringify({ imports: importMap }, null, 2);
  },
);
