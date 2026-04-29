export const lockedVersions = {
  FP: "0.24.12",
  REACT: "19.2.1",
  ADVISER_CEMENT: "0.5.22",
  CBORG: "4.5.8",
  ZOD: "4.3.6",
  ARKTYPE: "2.1.29",
  JOSE: "6.1.3",
  DOMPURIFY: "3.3.1",
  MULTIFORMATS: "13.4.0",
  YAML: "2.8.2",
  TAILWINDCSS: "4.1.18",
  REACT_ROUTER: "7.13.0",
  AG_GRID: "35.1.0",
  EMOTION: "11.13.5",
  SUCRASE: "3.35.1",
};

export const lockedGroupsVersions = {
  tailwindcss: {
    tailwindcss: "version:TAILWINDCSS",
  },
  fireproof: {
    "@adviser/cement": "version:ADVISER_CEMENT",
    yaml: "version:YAML",
    multiformats: "version:MULTIFORMATS",
    cborg: "version:CBORG",
    "cborg/json": "version:CBORG",
    "cborg/length": "version:CBORG",
    zod: "version:ZOD",
    arktype: "version:ARKTYPE",
    jose: "version:JOSE",
    "jose/jwt/decode": "version:JOSE",
    dompurify: "version:DOMPURIFY",
    // Firefly replaces Fireproof — both package names alias to vibe-runtime
    "use-fireproof": "alias:@vibes.diy/vibe-runtime",
    "@fireproof/use-fireproof": "alias:@vibes.diy/vibe-runtime",
    "@emotion/css": "version:EMOTION",

    // deps=react@19.2.1,react-dom@19.2.1
  },
  react: {
    react: "version:REACT",
    "react-dom": "version:REACT",
  },
  "react-dom-helpers": {
    "react-dom": "version:REACT",
    "react-dom/client": "version:REACT",
    "react/jsx-runtime": "version:REACT",
    "react/jsx-dev-runtime": "version:REACT",
  },
  "ag-grid": {
    "ag-grid-community": "version:AG_GRID",
    "ag-grid-react": "version:AG_GRID,deps:react",
  },
  "react-router": {
    "react-router": "version:REACT_ROUTER,deps:react",
    "react-router-dom": "version:REACT_ROUTER,deps:react",
  },
  "vibe-runtime": {
    "@vibes.diy/base": "privateNpm:",
    "@vibes.diy/vibe-runtime": "privateNpm:",
    "@vibes.diy/vibe-types": "privateNpm:",
    "@vibes.diy/api-types": "privateNpm:",
    "@vibes.diy/call-ai-v2": "privateNpm:",
    "@vibes.diy/vibe-db-explorer": "privateNpm:",
    "@vibes.diy/vibe-db-explorer/page": "privateNpm:",
    "@vibes.diy/vibe-db-explorer/root": "privateNpm:",
    "@vibes.diy/vibe-db-explorer/start": "privateNpm:",

    "call-ai": "alias:@vibes.diy/vibe-runtime",
    "img-vibes": "alias:@vibes.diy/vibe-runtime",
    "use-vibes": "alias:@vibes.diy/vibe-runtime",

    sucrase: "version:SUCRASE",
  },
};
