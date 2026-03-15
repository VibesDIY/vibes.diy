# CLI Release Process

## How to ship

```bash
# 1. Run checks
pnpm check

# 2. Push changes
git push origin jchris/cli-design

# 3. Tag
git tag use-vibes@v0.19.31-dev-cli -m "description"
git push origin use-vibes@v0.19.31-dev-cli

# 4. Monitor — ~3 min total when green
gh run list --workflow=use-vibes-publish.yaml --limit 1

# 5. Verify
npx use-vibes@0.19.31-dev-cli --help
npx use-vibes@0.19.31-dev-cli skills
```

Tags trigger CI on the `use-vibes@*` pattern regardless of branch.

## What gets published

5 npm packages from one tag:

- `@vibes.diy/prompts` → npm
- `call-ai` → npm
- `@vibes.diy/use-vibes-base` → npm
- `use-vibes` → npm

## If a tag fails

Bump the version number — never reuse a tag (npm caches by version).

```bash
git tag -d use-vibes@v0.19.31-dev-cli
git push origin :refs/tags/use-vibes@v0.19.31-dev-cli
# fix, commit, push
git tag use-vibes@v0.19.32-dev-cli -m "description"
git push origin use-vibes@v0.19.32-dev-cli
```

## Source conventions

- Local imports use `.js` extensions (Node/browser compatible)
- `pnpm check` runs build + lint + test before any release
- CLI-specific lint: `pnpm --filter use-vibes run check:cli`
- CLI tests: `pnpm --filter use-vibes-test run test:cli`
