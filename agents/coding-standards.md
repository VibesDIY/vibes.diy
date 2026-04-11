# Coding Standards

Team-wide standards for agent behavior and code review.

## No inline HTML in TypeScript

Never put HTML inside TypeScript code as template literal strings (code-in-code). Keep HTML in separate files and load/serve them. When a worker needs to serve HTML, put the HTML in a separate file (e.g. `ui.html`) and load it at build time or serve it as a static asset.

## No CSS imports across packages

Never use `@import "@vibes.diy/base/theme.css"` or `import "@pkg/foo.css"` across packages. The import map infrastructure requires every cross-package reference to be resolvable without extra import map entries. Any non-JS/TS asset (CSS, text, etc.) must be loaded via `loadAsset()` from `@adviser/cement`.

Use: `loadAsset("./file.css", { fallBackUrl: "https://esm.sh/@pkg/", basePath: () => import.meta.url })` and inject the result as a `<style>` tag. This repo avoids package.json `exports` fields entirely.

## Clickable links

Every link in responses must be clickable. Never output a bare reference without making it a proper link. `owner/repo#123` shorthand is NOT clickable in VS Code or the terminal — always use full markdown `[text](url)` links for PRs, issues, files, deployment URLs, and any other reference.

## Stable-entry param naming

Use dots (`.stable-entry.`) not `@` signs (`@stable-entry@`) for query parameter names. `@` gets URL-encoded to `%40` in browser address bars, making links ugly and hard to share.

## Logs are append-only

Never modify existing entries in setup logs or similar chronological docs — only append new information. Logs are a historical record; editing past entries destroys the timeline.

## Review commits before pushing

Read every commit diff before pushing. Check each pattern against the rules-bag — no `instanceof`, no complex stringification chains, no casts. If something looks like a workaround, it probably is. Ask for guidance or rethink the approach.
