# CLI Release Process

## How to ship

```bash
# 1. Push changes
git push origin jchris/cli-design

# 2. Tag
git tag use-vibes@v0.19.28-dev-cli -m "description"
git push origin use-vibes@v0.19.28-dev-cli

# 3. Monitor — ~3 min total when green
gh run list --workflow=use-vibes-publish.yaml --limit 1

# 4. Verify
npx use-vibes@0.19.28-dev-cli --help
npx use-vibes@0.19.28-dev-cli skills
```

Tags trigger CI on the `use-vibes@*` pattern regardless of branch.

## CI pipeline timing

| Step | ~Time | Fail point |
|------|-------|------------|
| Setup + install | 40s | rare |
| Deno check + test | 2s | local imports, lint |
| Format check | 10s | formatting |
| ESLint | 10s | type errors |
| Build published packages | 10s | tsgo errors |
| Publish 5 npm packages | 40s | npm auth, version conflict |
| dnt build + npm publish (use-vibes) | 30s | missing deps in import map |
| JSR publish | 15s | specifier issues |
| **Total (green)** | **~2.5 min** | |

Errors in early steps (deno check, format, lint, build) fail fast at ~1 min.
Publish failures happen at ~2 min. JSR is last — npm will have already succeeded.

## What gets published

5 npm packages + 1 JSR package, all from one tag:

- `@vibes.diy/prompts` → npm
- `call-ai` → npm
- `@vibes.diy/use-vibes-types` → npm
- `@vibes.diy/use-vibes-base` → npm
- `use-vibes` → npm (via dnt) + JSR (`@vibes-diy/use-vibes`)

## If a tag fails

Bump the version number — never reuse a tag (npm caches by version).

```bash
git tag -d use-vibes@v0.19.28-dev-cli
git push origin :refs/tags/use-vibes@v0.19.28-dev-cli
# fix, commit, push
git tag use-vibes@v0.19.29-dev-cli -m "description"
git push origin use-vibes@v0.19.29-dev-cli
```

## Source conventions

- Local imports use `.js` extensions (Node/browser compatible)
- Deno uses `--unstable-sloppy-imports` to resolve `.js` → `.ts`
- `check-local-import-specifiers` script enforces `.js` in `pnpm check`
- Deno-only files (`main.deno.ts`, `cli-output-deno.ts`, `build-npm.ts`) excluded from tsgo/ESLint, linted by `deno lint`
