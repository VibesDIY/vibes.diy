# Coding Standards

## No inline HTML in TypeScript

Never put HTML inside TypeScript code as template literal strings (code-in-code). Keep HTML in separate files and load/serve them.

## @adviser/cement

The codebase uses `@adviser/cement` as a core utility library. Key exports:

- **`loadAsset(path, opts)`** — load non-JS assets (text, CSS, markdown). See below.
- **`Result` / `exception2Result()`** — no throwing, wrap errors in Result
- **`URI` / `BuildURI`** — use instead of `new URL()` (URL is not stable)
- **`ResolveOnce` / `KeyedResolvOnce` / `Lazy`** — use instead of singletons
- **`Option`** — use instead of falsy checks
- **`Evento`** — event/message system across packages

### loadAsset

Use `loadAsset()` for any non-JS/TS asset (CSS, text, markdown, fixtures). Never use raw `@import` or `import` for CSS across packages.

**Server/build-time** (with CDN fallback):

```ts
const rText = await loadAsset("./llms/claude.txt", {
  fallBackUrl: "https://esm.sh/@vibes.diy/prompts/",
  basePath: () => import.meta.url,
});
```

**Browser** (from origin):

```ts
loadAsset("/app/routes/legal/tos-notes.md", {
  basePath: () => window.location.origin,
}).then((r) => setContent(r.Ok()));
```

**Tests** (with `urlDirname`):

```ts
const r = await loadAsset(pathOps.join("tests", "fixtures", filename), {
  basePath: () => urlDirname(import.meta.url).toString(),
  fallBackUrl: urlDirname(import.meta.url).toString(),
});
```

Returns a `Result` — use `.Ok()` for the value, `.isErr()` to check failure.

## Clickable links

Every link in responses must be clickable. Never output a bare reference without making it a proper link. `owner/repo#123` shorthand is NOT clickable in VS Code or the terminal — always use full markdown `[text](url)` links.

## Review commits before pushing

Read every commit diff before pushing. Check each pattern against the rules-bag — no `instanceof`, no complex stringification chains, no casts. If something looks like a workaround, rethink the approach.
