# Coding Standards

## No inline HTML in TypeScript

Never put HTML inside TypeScript code as template literal strings (code-in-code). Keep HTML in separate files and load/serve them.

## No CSS imports across packages

Never use `@import "@vibes.diy/base/theme.css"` or `import "@pkg/foo.css"` across packages. Non-JS/TS assets must be loaded via `loadAsset()` from `@adviser/cement` — use `loadAsset("./file.css", { fallBackUrl: "https://esm.sh/@pkg/", basePath: () => import.meta.url })` and inject as a `<style>` tag.

## Clickable links

Every link in responses must be clickable. Never output a bare reference without making it a proper link. `owner/repo#123` shorthand is NOT clickable in VS Code or the terminal — always use full markdown `[text](url)` links.

## Review commits before pushing

Read every commit diff before pushing. Check each pattern against the rules-bag — no `instanceof`, no complex stringification chains, no casts. If something looks like a workaround, rethink the approach.
