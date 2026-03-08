# CLI First Release — Dev Tag from PR Branch

Ship a dev release of the CLI from the `jchris/cli-design` branch via GitHub Actions.

---

## Pre-flight (verified locally)

All passing as of commit `973c2fe1`:

```
deno task --config use-vibes/pkg/deno.json check-cli   # ✅ 4 files checked
deno task --config use-vibes/pkg/deno.json test-cli     # ✅ 22/22 passed
node use-vibes/pkg/cli.js --help                        # ✅ prints help text
```

---

## How to ship (manual steps)

### 1. Push the branch

```bash
git push origin jchris/cli-design
```

### 2. Tag the dev release

Previous tags: `use-vibes@v0.19.8-dev` → next is `use-vibes@v0.19.9-dev-cli`.

```bash
git tag use-vibes@v0.19.9-dev-cli -m "CLI: deno-first runtime, cmd-ts routing, 22 tests"
git push origin use-vibes@v0.19.9-dev-cli
```

Tags can be pushed from any branch — CI triggers on the tag pattern `use-vibes@*` regardless of branch.

### 3. Monitor CI

Watch the workflow at: `https://github.com/nicholasgasior/vibes.diy/actions/workflows/use-vibes-publish.yaml`

CI will run (in order):
1. Deno CLI lint + test
2. `pnpm run format --check`
3. `pnpm run lint`
4. `pnpm build` (root validation)
5. Publish 5 packages sequentially: prompts → call-ai → types → base → use-vibes

All packages get version `0.19.9-dev-cli` extracted from the tag.

### 4. Verify after publish

```bash
npm view use-vibes versions --json | tail -5    # confirm version appeared
npx use-vibes --help                            # confirm CLI works from npm
npx use-vibes skills                            # confirm prompts package works
npx use-vibes system --skills fireproof         # confirm system prompt assembly
```

---

## What ships in this release

- **Deno-first CLI runtime** — `main.deno.ts` entry point, `run-cli.ts` runtime-agnostic core
- **Node/npm compatibility** — `cli.js` → tsx → `cli.ts` bridge for `npx use-vibes`
- **cmd-ts routing** — subcommands, option parsing, help generation
- **cement Result pattern** — all commands return `Result<void>`
- **Injectable CliOutput** — testable without process spawning
- **Working commands**: `help`, `skills`, `system --skills`
- **Stub commands**: `login`, `dev`, `live`, `generate`, `edit`, `publish`, `invite`
- **22 tests** — 14 unit + 8 smoke, all via `deno test`

---

## What does NOT ship (deferred)

- JSR publishing (`jsr.json`, `dnt`) — follow-up
- npm artifact smoke test in CI — follow-up
- `--no-check` / `--unstable-sloppy-imports` cleanup — follow-up
- Auth (`login` / `whoami`) — Step 2
- File watching (`dev` / `live`) — Step 5
- AI generation (`generate` / `edit`) — Step 8

---

## Known technical debt

1. `deno test` uses `--no-check` (monorepo type-resolution friction)
2. `--unstable-sloppy-imports` still required
3. Node wrapper (`cli.js` + tsx) is transitional
4. CI lint step has `|| true` (swallows failures)

---

## If the tag fails

If CI fails, delete the tag and re-tag after fixing:

```bash
git tag -d use-vibes@v0.19.9-dev-cli
git push origin :refs/tags/use-vibes@v0.19.9-dev-cli
# fix, commit, push
git tag use-vibes@v0.19.10-dev-cli -m "CLI: fix description"
git push origin use-vibes@v0.19.10-dev-cli
```

Never reuse a tag — npm caches by version number.
