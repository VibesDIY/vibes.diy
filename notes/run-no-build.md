# Run: No-Build Import Map Service

The "no-build sandbox" is core to the Run phase of the loop. Apps deploy instantly because there's no build step — the browser's native ES module system does the work, driven by a server-generated import map.

## How It Works

When a published vibe loads at `https://{appSlug}--{userSlug}.vibes.app/~{fsId}~/`:

1. Server receives request, extracts bindings from hostname + path
2. Loads the app's `FileSystemItem[]` from D1
3. Finds the app's own `import-map.json` (generated at publish time)
4. Merges with platform locked versions
5. Resolves all dependencies to CDN URLs
6. Renders an HTML page with a `<script type="importmap">` block
7. Browser loads everything natively — no bundler, no build

## Import Map Generation

### At Publish Time

`vibes.diy/api/svc/intern/write-apps.ts`

When code is published, the server:
1. Parses all JS files with `acorn` to find bare import specifiers
2. Collects every `import ... from 'package-name'`
3. Generates `import-map.json` mapping each bare specifier to a CDN URL
4. Stores it as a transform artifact alongside the app files

### At Serve Time

`vibes.diy/api/svc/intern/render-vibes.ts`

When the HTML page is served:
1. Load the app's `import-map.json` from filesystem
2. Call `vibesImportMap()` to parse it
3. Merge with `lockedGroupsVersions` (platform dependencies)
4. Resolve through `Dependencies.from().renderImportMap()`
5. Inject into HTML as `<script type="importmap">`

## Dependency Resolution Engine

`vibes.diy/api/svc/intern/import-map.ts`

The resolution system supports multiple version formats:

| Format | Example | Meaning |
|--------|---------|---------|
| `version:1.2.3` | `"version:19.2.1"` | Exact semver |
| `version:SYMBOL` | `"version:REACT"` | Symbolic, resolved from locked versions |
| `version:LATEST` | `"version:LATEST"` | Fetched from npm registry |
| `alias:pkg` | `"alias:@vibes.diy/vibe-runtime"` | Points to another entry |
| `privateNpm:` | `"privateNpm:"` | Workspace/private registry |
| `deps:react,react-dom` | `"deps:react"` | Declares external dependencies |

Resolution renders to esm.sh URLs: `https://esm.sh/react@19.2.1`

## Locked Platform Versions

`vibes.diy/api/svc/intern/grouped-vibe-import-map.ts`

Platform dependencies are version-locked to prevent conflicts:

```typescript
lockedVersions = {
  FP: "0.24.12",          // Fireproof
  REACT: "19.2.1",
  ADVISER_CEMENT: "0.5.22",
}

lockedGroupsVersions = {
  fireproof: {
    "@adviser/cement": "version:ADVISER_CEMENT",
    "@fireproof/core": "version:FP",
    "use-fireproof": "version:FP,deps:react",
  },
  react: {
    "react": "version:REACT",
    "react-dom": "version:REACT",
  },
  "vibe-runtime": {
    "@vibes.diy/base": "privateNpm:",
    "@vibes.diy/vibe-runtime": "privateNpm:",
    "call-ai": "alias:@vibes.diy/vibe-runtime",
  },
}
```

This ensures every vibe gets the same React, Fireproof, and runtime versions.

## Client-Side Import Map

`vibes.diy/pkg/app/config/import-map.ts`

Single source of truth for the editor's preview iframe:

```typescript
VIBES_VERSION = "0.19.8-dev"

getLibraryImportMap() → {
  "react": "https://esm.sh/react@19.2.1",
  "use-fireproof": "https://esm.sh/use-vibes@0.19.8-dev",
  "call-ai": "https://esm.sh/call-ai@0.19.8-dev",
}
```

Editor preview and published vibes use the same resolution — what you see in dev is what runs in production.

## Generated HTML

The final served page looks like:

```html
<html>
<head>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19.2.1",
      "react-dom": "https://esm.sh/react-dom@19.2.1",
      "use-fireproof": "https://esm.sh/use-vibes@0.19.8",
      "call-ai": "https://esm.sh/call-ai@0.19.8",
      "@fireproof/core": "https://esm.sh/@fireproof/core@0.24.12",
      "d3": "https://esm.sh/d3@7?external=react,react-dom",
      ...app-specific imports
    }
  }
  </script>
  <script type="module" src="https://esm.sh/@tailwindcss/browser@4"></script>
</head>
<body>
  <div class="vibe-app-container"></div>
  <script type="module">
    import { mountVibe, registerDependencies } from '@vibes.diy/vibe-runtime';
    import App from '/~fsId~/app.jsx';

    registerDependencies({ appSlug, userSlug, fsId }, { imports })
      .then(() => mountVibe([App], { usrEnv: {...} }));
  </script>
</body>
</html>
```

## Why No Build

- **Instant deploys** — publish means "write files to D1 and compute an fsId." No CI, no pipeline.
- **Instant updates** — new fsId, new URL, immediately live.
- **Browser-native loading** — import maps are a web standard, no bundler runtime needed.
- **Version coordination** — locked platform deps prevent diamond dependency problems.
- **CDN-backed** — esm.sh handles transpilation and caching at the edge.

## Asset Caching

Two-tier Cloudflare cache:
1. **CID cache** — global, keyed by content hash: `https://asset-cache.vibes.app/{assetId}`
2. **URL cache** — keyed by request path

Cache miss → D1 query → populate both tiers. Same content never stored twice (content-addressed via SHA-256 → CID).

## React Singleton Requirement

All esm.sh packages that depend on React must use `?external=react,react-dom` to prevent duplicate React instances. The import map handles this — app code just writes `import React from 'react'` and the map resolves it to the single shared instance.
