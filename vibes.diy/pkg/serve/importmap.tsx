import React from "react";

function enhance(
  importMap: Record<string, string | undefined>,
  ver: Record<string, string>,
): Record<string, string> {
  const enhancedMap: Record<string, string> = {};

  for (const [key, value] of Object.entries(importMap)) {
    if (value === undefined) {
      continue;
    }

    // Replace version placeholders
    let enhancedValue = value;
    for (const [verKey, verValue] of Object.entries(ver)) {
      if (enhancedValue === verKey) {
        // Use the actual package name from the key
        if (key.endsWith("/")) {
          enhancedValue = `https://esm.sh/${key}${verValue}/`;
        } else {
          enhancedValue = `https://esm.sh/${key}@${verValue}`;
        }
        break;
      }
    }

    enhancedMap[key] = enhancedValue;
  }
  return enhancedMap;
}

export interface ImportMapProp {
  versions: {
    FP: string;
  };
}

export function ImportMap(prop?: Partial<ImportMapProp>) {
  if (!(prop && prop.versions)) {
    throw "WE need the Fireproof Version to be set";
  }
  const { versions } = prop;

  const importMap = {
    tailwindcss: "https://esm.sh/tailwindcss",
    "dequal/lite": "https://esm.sh/dequal@2.0.3/lite",
    "use-sync-external-store": "https://esm.sh/use-sync-external-store@1.6.0",
    "@adviser/cement": "https://esm.sh/@adviser/cement@0.5.5",
    "@clerk/clerk-react":
      "https://esm.sh/@clerk/clerk-react?deps=react@19.2.1,react-dom@19.2.1",
    "@clerk/clerk-js": "https://esm.sh/@clerk/clerk-js@5",
    multiformats: "https://esm.sh/multiformats",
    cborg: "https://esm.sh/cborg",
    "cborg/json": "https://esm.sh/cborg/json",
    "cborg/length": "https://esm.sh/cborg/length",
    zod: "https://esm.sh/zod",
    jose: "https://esm.sh/jose",
    yaml: "https://esm.sh/yaml",
    "posthog-js":
      "https://esm.sh/posthog-js?deps=react@19.2.1,react-dom@19.2.1",
    "posthog-js@1.302.2":
      "https://esm.sh/posthog-js?deps=react@19.2.1,react-dom@19.2.1",
    "posthog-js/react":
      "https://esm.sh/posthog-js/react?deps=react@19.2.1,react-dom@19.2.1",

    react: "https://esm.sh/react@19.2.1",

    "/react": "https://esm.sh/react@19.2.1",

    "react?target=es2022": "https://esm.sh/react@19.2.1",
    "/react?target=es2022": "https://esm.sh/react@19.2.1",

    "react@^=18?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@^=18?target=es2022": "https://esm.sh/react@19.2.1",

    "react@%3E=18?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@%3E=18?target=es2022": "https://esm.sh/react@19.2.1",
    "react@>=18?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@>=18?target=es2022": "https://esm.sh/react@19.2.1",

    "react@%3E=18": "https://esm.sh/react@19.2.1",
    "/react@%3E=18": "https://esm.sh/react@19.2.1",
    "react@>=18": "https://esm.sh/react@19.2.1",
    "/react@>=18": "https://esm.sh/react@19.2.1",

    "/react@^19.2.0?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@19.2.1/es2022/react.mjs": "https://esm.sh/react@19.2.1",
    "react@19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",
    "/react@19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",
    "react-dom": "https://esm.sh/react-dom@19.2.1",
    "react-dom/client": "https://esm.sh/react-dom@19.2.1/client",
    "react/jsx-runtime": "https://esm.sh/react@19.2.1/jsx-runtime",
    "react/jsx-dev-runtime": "https://esm.sh/react@19.2.1/jsx-dev-runtime",
    "react-router":
      "https://esm.sh/react-router?deps=react@19.2.1,react-dom@19.2.1",
    "react-router-dom":
      "https://esm.sh/react-router-dom?deps=react@19.2.1,react-dom@19.2.1",
    "call-ai": "https://esm.sh/call-ai@v0.14.5",

    "react-hot-toast":
      "https://esm.sh/react-hot-toast?deps=react@19.2.1,react-dom@19.2.1",
    "@radix-ui/react-slot": "https://esm.sh/@radix-ui/react-slot",
    "class-variance-authority": "https://esm.sh/class-variance-authority",
    clsx: "https://esm.sh/clsx",
    "react-markdown": "https://esm.sh/react-markdown",

    "tailwind-merge": "https://esm.sh/tailwind-merge",
    "@monaco-editor/react": "https://esm.sh/@monaco-editor/react",
    "@shikijs/monaco": "https://esm.sh/@shikijs/monaco",
    "shiki/core": "https://esm.sh/shiki/core",
    "shiki/langs/javascript.mjs": "https://esm.sh/shiki/langs/javascript.mjs",
    "shiki/langs/typescript.mjs": "https://esm.sh/shiki/langs/typescript.mjs",
    "shiki/langs/jsx.mjs": "https://esm.sh/shiki/langs/jsx.mjs",
    "shiki/langs/tsx.mjs": "https://esm.sh/shiki/langs/tsx.mjs",
    "shiki/themes/github-dark-default.mjs":
      "https://esm.sh/shiki/themes/github-dark-default.mjs",
    "shiki/themes/github-light-default.mjs":
      "https://esm.sh/shiki/themes/github-light-default.mjs",
    "shiki/engine/oniguruma": "https://esm.sh/shiki/engine/oniguruma",
    "shiki/wasm": "https://esm.sh/shiki/wasm",
    "react-cookie-consent":
      "https://esm.sh/react-cookie-consent?deps=react@19.2.1,react-dom@19.2.1",

    "use-vibes": "/dist/use-vibes/pkg/index.js",
    "use-fireproof": "/dist/use-vibes/pkg/index.js",

    "@vibes.diy/prompts": "/dist/prompts/pkg/index.js",
    "@vibes.diy/use-vibes-base": "/dist/use-vibes/base/index.js",

    "@fireproof/core-base": "FP",
    "@fireproof/core-blockstore": "FP",
    "@fireproof/core-cli": "FP",
    "@fireproof/core-device-id": "FP",
    "@fireproof/core-gateways-base": "FP",
    "@fireproof/core-gateways-cloud": "FP",
    "@fireproof/core-gateways-file-deno": "FP",
    "@fireproof/core-gateways-file-node": "FP",
    "@fireproof/core-gateways-file": "FP",
    "@fireproof/core-gateways-indexeddb": "FP",
    "@fireproof/core-gateways-memory": "FP",
    "@fireproof/core-keybag": "FP",
    "@fireproof/core-protocols-cloud": "FP",
    "@fireproof/core-protocols-dashboard": "FP",
    "@fireproof/core-runtime": "FP",
    "@fireproof/core-types-base": "FP",
    "@fireproof/core-types-blockstore": "FP",
    "@fireproof/core-types-protocols-cloud": "FP",
    "@fireproof/core-types-runtime": "FP",
    "@fireproof/core": "FP",
    "@fireproof/vendor": "FP",
    "@fireproof/use-fireproof": "FP",
  };

  return (
    <script type="importmap">
      {JSON.stringify({ imports: enhance(importMap, versions) }, null, 2)}
    </script>
  );
}
