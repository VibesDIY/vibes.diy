---
name: dependabot-review
description: >
  Reviews every open Dependabot npm PR in the vibes.diy monorepo and produces a single
  consolidated report with merge verdicts. Use this skill when the user says things like
  "audit dependabot", "review all open dependabot PRs", "which dependabot PRs are ready to merge",
  "go through the open dep PRs", "check dependabot", or asks for a status/report on pending
  dependency updates. Discovers PRs automatically with `gh` — no URLs needed.
---

# Dependabot npm Upgrade Audit

Review every open Dependabot PR in the current repo and produce one consolidated report. Tuned for **TypeScript on Node 22+**, **pnpm workspaces**, **Vite/Vitest**, **React 19**, **Cloudflare Workers**, and **Fireproof / use-fireproof**.

Tooling assumed: `pnpm`, `gh`, and a checkout of the monorepo root.

## Workflow

### Step 1: Discover open Dependabot PRs

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
gh pr list --author "app/dependabot" --state open \
  --json number,title,url,createdAt,headRefName,labels \
  --limit 50
```

The `app/` prefix is required — Dependabot authors as `app/dependabot`. If the list is empty, tell the user "No open Dependabot PRs in <repo>." and stop.

Surface scope in one line: "Found N open Dependabot PRs. Analyzing each now…"

**Queue saturation check.** This repo's `.github/dependabot.yml` sets `open-pull-requests-limit: 20`. If `gh` returns ~20 PRs (or the count visibly equals the configured limit), the queue is **at capacity** and Dependabot is silently blocked from opening new PRs — including security PRs — until merges happen. Call this out in the preamble: "Queue at 19/20 — Dependabot is blocked from opening new PRs until some land." That's a meaningful triage signal even before the per-PR analysis.

**Title shapes you'll see in this repo (conventional-commits is dominant):**
- `chore(deps): bump <pkg> from <old> to <new>` — production dep
- `chore(deps-dev): bump <pkg> from <old> to <new>` — dev dep
- `Bump <pkg> from <old> to <new>` — plain (default Dependabot format; rare here)
- `Bump <pkg> from <old> to <new> in /<workspace-path>` — workspace-scoped (note the path)
- `Bump the <group> group with N updates` — grouped update; treat each diff entry as a separate package. Not currently in use in this repo, but possible if `dependabot.yml` adds groups.

### Step 2: Read repo constraints once

Before analyzing PRs, read `.github/dependabot.yml` so you can flag PRs that violate ignore rules. Known constraints in this repo (verify against the live file):

- `@adviser/cement` — major + minor ignored
- `drizzle-kit` — versions `>0.30.6` ignored (also patched via `pnpm.patchedDependencies`)
- `react`, `react-dom` — major + minor ignored
- `zod` — major ignored
- `vite`, `@vitejs/plugin-react` — major ignored

Any PR that conflicts with these is `Hold` with a one-liner pointing at the rule.

Also note `pnpm.overrides` (currently `sharp: 0.33.5`) and `pnpm.patchedDependencies` from the root `package.json` — bumps to overridden/patched packages need extra care.

### Step 3: Analyze each PR

For each PR, run analysis in parallel where the tool call structure allows. Per PR, gather:

**3a. Diff**
```bash
gh pr view <NUMBER> --repo <OWNER/REPO> --json title,body,url,files,headRefName
gh pr diff <NUMBER> --repo <OWNER/REPO>
```

Extract for each package being updated:
- **Name** (preserve scope, e.g. `@types/node`), **old → new version**
- **Workspace location** — which `package.json` is touched (root, `vibes.diy/pkg`, `hosting/pkg`, `call-ai/pkg`, etc.). Same package can live in many workspaces; Dependabot may only bump one.
- **Dependency type** — `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies` (read the diff hunk header).
- **Bump type** — `patch` (`x.y.Z`), `minor` (`x.Y.0`), `major` (`X.0.0`), or `pre` (any `0.x → 0.y` — semver explicitly excludes 0.x from compat guarantees, treat as major-equivalent).

Skim the `pnpm-lock.yaml` diff for transitive surprises — a top-level patch can drag transitives across a major.

**3b. Changelog (between old and new versions)**

Try sources in order:
1. **GitHub Releases** — most reliable. Find source repo via `npm view <pkg> repository.url`, then:
   ```bash
   gh release view v<new> --repo <owner>/<repo>
   ```
   Monorepo packages often tag as `<pkg>@<version>`.
2. **Repo CHANGELOG** — `CHANGELOG.md`, `HISTORY.md`, or `packages/<name>/CHANGELOG.md` (Changesets).
3. **npm metadata** — `npm view <pkg>@<new> homepage repository.url deprecated`. If the package is deprecated, surface that immediately — Dependabot will keep proposing upgrades on a dead-end package.
4. **`npm diff <pkg>@<old> <pkg>@<new>`** — last resort, shows actual shipped diff.

If no changelog is findable, say so explicitly. Do not invent entries.

Organize findings by importance:
1. **Breaking changes** — removed/renamed APIs, changed defaults, dropped Node version, ESM/CJS export-map changes, `.d.ts` shape changes, peer-dep tightening.
2. **Deprecations** — still works, will break later.
3. **Security fixes** — float to top of report. If PR title/body mentions a CVE/GHSA, treat as security.
4. **Notable bug fixes / new features** — only if relevant to this codebase.

**3c. Codebase impact**

```bash
grep -rn "\"<pkg>\":" --include=package.json
grep -rn "from ['\"]<pkg>" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs'
grep -rn "require(['\"]<pkg>" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.cjs'
```

Workspace map (active surface — from `pnpm-workspace.yaml`):
- `vibes.diy/pkg` — main React Router web app (editor, dashboard, chat UI)
- `vibes.diy/api/*` — API services (Cloudflare Workers / Node)
- `vibes.diy/base`, `vibes.diy/stable-entry`, `vibes.diy/failback-homepage` — entry-point packages
- `call-ai/pkg`, `call-ai/v2` — LLM-call abstraction
- `prompts/pkg` — prompt assets and helpers
- `hosting/pkg`, `hosting/base` — Cloudflare hosting infra
- `img-vibes/pkg` — image generation
- `utils/pkg` — shared utilities

The `use-vibes/*` workspaces exist in `pnpm-workspace.yaml` but are not part of the active product. PRs that only touch `use-vibes/*` are low-impact unless the user says otherwise.

Don't forget config files: `vite.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `wrangler.toml` / `wrangler.jsonc`, `tsconfig*.json`, `netlify.toml`.

**Workspace consistency check:** the repo enforces `pnpm dedupe --check` in CI. If Dependabot bumped a package in only one workspace and it's also pinned elsewhere, the PR will fail CI. Flag as `Verify` or `Investigate`, not auto-`Merge`. The fix is `pnpm update <pkg>@<version> -r && pnpm dedupe`.

**Coordinated package families.** Some npm libraries ship as a set of sibling packages that must move in lockstep. If only some siblings have open PRs, the partial bump is a real version-split hazard — even when each PR looks innocuous on its own. Known families in this repo:

| Family | Sibling packages | Notes |
|--------|------------------|-------|
| **React Router 7** | `react-router`, `react-router-dom`, `@react-router/serve`, `@react-router/dev` | All four must match. Dependabot opens one PR per package even when they're the same version bump — recommend merging the family together. |
| **Vitest 4** | `vitest`, `@vitest/browser`, `@vitest/ui`, `@vitest/coverage-v8`, `@vitest/browser-playwright` | A split (e.g. `@vitest/browser@4.1.5` against `vitest@4.1.4`) causes obscure runner errors. Check the lockfile diff for `vitest@4.1.X` showing two resolved versions. |
| **Tailwind 4** | `tailwindcss`, `@tailwindcss/vite` | Vite plugin is tightly coupled to engine version. |
| **React 19** | `react`, `react-dom` | Major+minor ignored in `dependabot.yml`. |
| **Cloudflare** | `wrangler`, `@cloudflare/vite-plugin`, `@cloudflare/puppeteer`, `@cloudflare/*` | Less tightly coupled than the others, but worth a coordinated review since they hit the same deploy target. |
| **TypeScript / lint** | `typescript`, `@typescript/native-preview`, `typescript-eslint`, `@typescript-eslint/*`, `eslint`, `@eslint/js` | Compiler/linter compat — bump together when feasible. |

When you see two or more PRs in the same family, group them in the report's overall recommendation under one entry: "Merge as a set: #1451 + #1450 + #1448 + #1443 (react-router 7.14.1 → 7.14.2)". Don't auto-`Merge` a family-member PR if its siblings are unaccounted for — that's `Verify`.

For `devDependencies`-only bumps, note the lower risk profile. But `@types/*` bumps are not zero-risk: a type shape change fails the typecheck pass in `pnpm build`.

### Step 4: Verdict per PR

Decide one of:
- **Merge** — safe, low risk
- **Verify** — looks safe but specific things to check first (list them)
- **Investigate** — needs human judgment (list concerns)
- **Hold** — breaking changes, peer-dep tightening, ignore-rule violation, or workspace-split risk needing code changes first

Risk factors:

| Factor | Lower Risk | Higher Risk |
|--------|-----------|-------------|
| Bump type | Patch on `>=1.0` | Major, or `0.x → 0.y` |
| Listed as | `devDependencies` | `dependencies` (ships) |
| Usage scope | 1-2 files, build-only | Widespread, in LLM/sync/hosting hot path |
| Feature area | Linting, storybook, dev tooling | Fireproof sync, LLM streaming, Cloudflare hosting |
| Changelog | Bug fixes only | API changes, dropped Node/React, ESM/CJS export-map shifts |
| Peer-dep change | None | Requires newer React / Node / TypeScript |
| Lockfile diff | Single line | Cascades across many transitives |
| Workspace coverage | Bumped consistently | Single-workspace bump (will fail `pnpm dedupe --check`) |
| Sibling family | Standalone, or whole family bumped | Partial-family bump (e.g., `@vitest/browser` without `vitest`) |
| Security advisory | No | Yes (merge sooner) |
| `dependabot.yml` ignore | None | Violates a configured rule → `Hold` |

**Do not** recommend running the test suite — CI handles `pnpm check`. Instead, call out things CI won't catch:
- esm.sh CDN caches bad URLs after publishing `@fireproof/*` or `@vibes.diy/*` (per `CLAUDE.md`)
- Cloudflare Worker runtime drift (wrangler types pass, runtime API changed)
- React 19 hydration / server-client boundary regressions
- Vite 7 plugin/HMR regressions visible only with `pnpm dev`
- New deprecation warnings in dev console

### Step 5: Produce the consolidated report

Emit in this order:

**1. Preamble**

> Reviewed N open Dependabot PRs in <repo>.

**2. Summary table** — the first thing the dev reads. Render as GitHub-flavored markdown:

| Column     | Contents                                                              |
|------------|-----------------------------------------------------------------------|
| `#`        | PR number, linked as `[#1234](url)`                                   |
| `Package`  | Package name (with scope). Multi-package / grouped: comma-separate    |
| `Bump`     | `old → new` (e.g., `4.1.2 → 4.1.4`)                                   |
| `Type`     | `patch` / `minor` / `major` / `pre`. Mark security PRs with `[sec]`   |
| `Age`      | Days since `createdAt` (e.g., `3d`, `21d`)                            |
| `Verdict`  | `Merge`, `Verify`, `Investigate`, `Hold`                              |
| `Why`      | One short clause (≤ 10 words). Concrete, not generic                  |

**Sort:** `Merge → Verify → Investigate → Hold`. Within each bucket, oldest first (stalest PRs rise — they often hide the real merge friction). **Security PRs jump to the top of the entire table.**

Don't add extra columns (branch, author, CI status). Seven is the comfortable ceiling for terminal width.

**3. Details** — one subsection per PR, ~15-25 lines each:

```
## #<NUMBER> `<package>` (<old> → <new>)

### Bump Type
[patch/minor/major/pre] — [one line: what this means for risk]

### What Changed
[Changelog highlights, breaking changes first. If nothing notable, "No breaking changes or deprecations."]

### Breaking Changes in This Codebase
[Only if breaking changes affect this repo: list each with affected file and concrete fix. Otherwise omit.]

### Codebase Impact
[Grouped list, one line per area. Note workspace coverage if relevant.]

### Recommendation
[Verdict + 1-3 sentences, plus anything CI won't catch.]
```

For grouped/multi-package PRs, one section per package and one combined recommendation.

**4. Overall recommendation** — group by verdict so the dev can work top-to-bottom. Collapse coordinated-family PRs into a single entry:

```
### Merge as a set
- #1451 + #1450 + #1448 + #1443 — react-router family 7.14.1 → 7.14.2
- #1455 + #1447 — tailwindcss + @tailwindcss/vite 4.2.2 → 4.2.4

### Merge now
- #1444 knip 6.3.1 → 6.7.0 (dev-only)
- …

### Verify, then merge
- #1458 + #1457 — @vitest/browser + @vitest/ui 4.1.4 → 4.1.5 — verify @vitest/browser-playwright (~4.1.4) and vitest (~4.1.2) don't split the resolution graph
- #1459 @clerk/react 6.2.1 → 6.5.0 — auth surface, eyeball changelog for session/JWT changes

### Investigate
- …

### Hold
- #1180 react 19.2.5 → 20.0.0 — violates dependabot.yml ignore rule (only patches allowed)
```

### Step 6: Offer to post findings as PR comments

After the report, ask once:

> Want me to post each PR's review as a comment on its PR? (yes / no / selective)

- **yes** → post to every PR analyzed
- **no** → stop; the chat report is the only output
- **selective** → ask which PR numbers, then post to just those

Never post automatically.

**Idempotency** — before posting to any PR:

```bash
gh pr view <NUMBER> --repo <OWNER/REPO> --json comments --jq '.comments[].body' | grep -q 'dependabot-audit:v1'
```

If the marker is found, ask: "PR #1234 already has a prior review comment — re-post anyway?" Default to skipping if no answer.

**Command** (use `--body-file` so newlines and tables survive the shell):

```bash
gh pr comment <NUMBER> --repo <OWNER/REPO> --body-file /tmp/dep-review-<NUMBER>.md
```

**Comment template:**

```markdown
## Dependabot review

**Verdict:** <Merge / Verify / Investigate / Hold>

<one-line reason>

<details>
<summary>Full review</summary>

<the per-PR detail section: Bump Type, What Changed, Breaking Changes in This Codebase if any, Codebase Impact, Recommendation>

</details>

<!-- dependabot-audit:v1 -->
```

The verdict and one-liner sit above the fold. The `<details>` block keeps long analysis collapsed. The trailing HTML comment is the idempotency marker. Do not add any signature, "posted by", or attribution line.

If `gh pr comment` fails for one PR (locked, rate-limited, no permission), report inline and continue. Don't abort the batch.

After posting, show:

> Posted N comments: [#1234, #1230, …]. Skipped M: [#1180 (had prior review)].

## Codebase Context

The **vibes.diy** monorepo — a pnpm workspace on Node 22+ shipping:
- the **vibes.diy** web app (React 19 + React Router 7 / Vite 7),
- the **call-ai** LLM-call abstraction,
- **hosting/** infra on Cloudflare Workers (`wrangler`), and
- assorted prompt / image / utility packages.

Test runner: **Vitest 4**. Compiler: **TypeScript 6**. Linter: **eslint 10 + typescript-eslint 8** (no `any`, no unused vars, no unused imports, `import type` for types). Full gate: `pnpm check` = format + build + test + lint.

**High-risk** (user-facing, runtime-critical, hard to roll back):
- **Fireproof / sync core** — `@fireproof/*`, `use-fireproof`, `@adviser/cement`. `@adviser/cement` major+minor ignored in `dependabot.yml`. Bad publishes of `@vibes.diy/*` or `@fireproof/*` cache at the esm.sh CDN.
- **Auth** — `@clerk/react`. Auth flows, session/JWT, redirect handling. Minor bumps can change session shape.
- **React** — `react`, `react-dom`. Major+minor ignored in `dependabot.yml`; only patches expected.
- **React Router 7** — `react-router`, `react-router-dom`, `@react-router/serve`, `@react-router/dev`. Sibling family; bump as a set. Drives every route in `vibes.diy/pkg`.
- **Database driver** — `@neondatabase/serverless`. Postgres serverless driver in the API path; runtime-critical. Pair with `drizzle-kit` (schema tooling, pinned `<=0.30.6` via `dependabot.yml` and patched via `pnpm.patchedDependencies`; any `>0.30.6` PR is `Hold`).
- **LLM call surface** — `call-ai/pkg` and its OpenAI/OpenRouter/fetch deps. Streaming regressions miss CI.
- **Cloudflare hosting** — `wrangler`, `@cloudflare/vite-plugin`, `@cloudflare/puppeteer`, `@cloudflare/*`. Type-pass at build time, runtime-fail at deploy.
- **Build** — `vite`, `@vitejs/plugin-react`. Majors ignored.
- **Validation** — `zod`. Major ignored.

**Medium-risk:**
- Styling — `tailwindcss`, `@tailwindcss/vite`, `prettier-plugin-tailwindcss`. Tailwind 4 family. Sibling bumps must move together.
- Forms / UI — `react-hook-form`. Used in form-heavy editor flows; minor bumps occasionally shift validation timing.
- Analytics — `posthog-js`. Ships in the client bundle; SDK regressions are user-visible but rarely breaking.
- Crypto — `@noble/hashes`. Used in sync/auth signatures; treat minor bumps with care.
- Test infra — `vitest`, `@vitest/browser`, `@vitest/ui`, `@vitest/coverage-v8`, `@vitest/browser-playwright`, `@playwright/test`, `playwright`, `playwright-chromium`. Sibling family — bump as a set.
- Storybook — used in `vibes.diy/pkg` and (when active) other UI workspaces. CI-runnable, so regressions surface, but a Storybook upgrade can break MDX/CSF parsing.
- Type packages — `@types/node`, `@types/deno`, runtime-lib `@types/*`. Type-only but shape changes fail typecheck.
- TypeScript / lint — `typescript`, `@typescript/native-preview`, `typescript-eslint`, `eslint`, `@eslint/js`, `eslint-plugin-import`, `prettier`. Sibling family. Flat-config changes in eslint 10 break `lint` script.
- Dev tooling — `knip`, `serve`.

**Lower-risk** (build/install surface only):
- Netlify CLI / netlify, and packages under `pnpm.onlyBuiltDependencies` (`@parcel/watcher`, `@tailwindcss/oxide`, `core-js`, `es5-ext`, `esbuild`, `sharp`, `unix-dgram`, `unrs-resolver`, `workerd`). Override active: `sharp: 0.33.5`.
