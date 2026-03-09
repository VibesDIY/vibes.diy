# CLI First Release — Dev Tag from PR Branch

Ship a dev release of the CLI from the `jchris/cli-design` branch via GitHub Actions.

---

## Result

**Tag:** `use-vibes@v0.19.16-dev-cli` — all 5 packages published successfully.

It took 8 tag attempts (v0.19.9 through v0.19.16) to get a clean release. Issues fixed along the way:

1. **pnpm version mismatch** — `actions/runtime/action.yaml` pinned `version: 10` conflicting with `packageManager` field. Fix: removed explicit version.
2. **CFEnv type missing** — `vibes.diy/api/types/cf-env.ts` was referenced but never created (WIP from another branch). Fix: created stub interface.
3. **Monorepo-wide type checking** — `pnpm build` at root triggers `tsgo` across all packages. Fix: scoped CI validation to only the 5 published packages.
4. **npm token permissions** — granular access token needed "Bypass 2FA" enabled for CI automation.
5. **Unpublished workspace dep** — `@vibes.diy/call-ai-v2` was a workspace-only package listed as a dependency of `prompts`. Fix: removed dep, inlined the ChatMessage type.
6. **Stale lockfile** — `pnpm-lock.yaml` didn't reflect the dependency removal. Fix: ran `pnpm install`.

### Smoke test

```
$ npx use-vibes --help
# ✅ prints help text (with DEP0151 warning about missing exports in prompts — fixed in follow-up)

$ npx use-vibes skills
# ✅ lists available skills

$ npx use-vibes system --skills fireproof
# ✅ assembles system prompt
```

---

## How to ship (for future releases)

### 1. Push the branch

```bash
git push origin jchris/cli-design
```

### 2. Tag the dev release

```bash
git tag use-vibes@v0.19.17-dev-cli -m "description"
git push origin use-vibes@v0.19.17-dev-cli
```

Tags can be pushed from any branch — CI triggers on the tag pattern `use-vibes@*` regardless of branch.

### 3. Monitor CI

Watch the workflow at the GitHub Actions tab, workflow `use-vibes-publish`.

CI runs (in order):
1. Deno CLI check + test
2. `pnpm run format --check`
3. `pnpm run lint`
4. Build published packages (prompts → call-ai → types → base → use-vibes)
5. Publish 5 packages sequentially

### 4. Verify after publish

```bash
npm view use-vibes versions --json | tail -5
npx use-vibes --help
npx use-vibes skills
npx use-vibes system --skills fireproof
```

---

## What shipped in v0.19.16-dev-cli

- **Deno-first CLI runtime** — `main.deno.ts` entry point, `run-cli.ts` runtime-agnostic core
- **Node/npm compatibility** — `cli.js` → tsx → `cli.ts` bridge for `npx use-vibes`
- **cmd-ts routing** — subcommands, option parsing, help generation
- **cement Result pattern** — all commands return `Result<void>`
- **Injectable CliOutput** — testable without process spawning
- **Working commands**: `help`, `skills`, `system --skills`
- **Stub commands**: `login`, `dev`, `live`, `generate`, `edit`, `publish`, `invite`
- **22 tests** — 14 unit + 8 smoke, all via `deno test`

---

## Known technical debt

1. `deno test` uses `--no-check` (monorepo type-resolution friction)
2. `--unstable-sloppy-imports` still required
3. Node wrapper (`cli.js` + tsx) is transitional
4. Trusted Publishing not yet configured (tracked in issue #1087)

---

## If a tag fails

Delete the tag and re-tag with the next version number:

```bash
git tag -d use-vibes@v0.19.17-dev-cli
git push origin :refs/tags/use-vibes@v0.19.17-dev-cli
# fix, commit, push
git tag use-vibes@v0.19.18-dev-cli -m "description"
git push origin use-vibes@v0.19.18-dev-cli
```

Never reuse a tag — npm caches by version number.
