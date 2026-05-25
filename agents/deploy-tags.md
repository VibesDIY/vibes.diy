# Deploy Tags

## Cloudflare deploy (`vibes-diy-deploy.yaml`)

| Prefix         | Environment | Job          | Queue deploys?            |
| -------------- | ----------- | ------------ | ------------------------- |
| `vibes-diy@p*` | prodv2      | compile_test | Yes (CLOUDFLARE_ENV=prod) |
| `vibes-diy@c*` | cli         | deploy_cli   | No (shared prod queue)    |
| `vibes-diy@d*` | dev         | compile_test | No                        |

## Package publish (`package-deploy.yaml`)

| Prefix   | Environment | Workflow             |
| -------- | ----------- | -------------------- |
| `pkg@p*` | production  | CI Vibes.Diy Publish |
| `pkg@s*` | staging     | CI Vibes.Diy Publish |
| `pkg@d*` | dev         | CI Vibes.Diy Publish |

Convention for dev iterations: `pkg@d<next-prod-ver>-dev.<N>` — e.g. with prod at `pkg@p2.2.12`, dev iterations are `pkg@d2.2.13-dev.1`, `pkg@d2.2.13-dev.2`, `pkg@d2.2.13-dev.3`, … staging the next `p2.2.13` cut. Increment `N` each push.

⚠️ **Do not use `pkg@dev<ver>` (no dash, no `-dev.N`).** The workflow's catch-all routes it to the dev env so it appears to work, but it breaks the cadence and version-ordering convention. Several off-pattern tags exist in history (`pkg@dev2.2.13`, `pkg@dev2.2.14`) — don't follow them.

The `pkg` tags publish the CLI (`vibes-diy` / `use-vibes` npm packages) and related workspace packages. Use `pkg@p*` for production releases.

## Tagging procedure

### Cloudflare deploys (`vibes-diy@*`)

1. List existing tags by creation date:
   ```
   git tag -l 'vibes-diy@p*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   git tag -l 'vibes-diy@c*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   git tag -l 'vibes-diy@d*' --sort=creatordate --format='%(creatordate:short) %(refname:short)'
   ```
2. Pick next `0.x.y` — **use the same version number across all environments** when deploying the same code (e.g. `p0.2.16` and `c0.2.16`). Keep numbers sequential for easy ordering downstream
3. Tag the ref (branch or commit):
   ```
   git tag -a vibes-diy@p0.X.Y <ref> -m "description"
   git tag -a vibes-diy@c0.X.Y <ref> -m "description"
   git tag -a vibes-diy@d0.X.Y <ref> -m "description"
   ```
4. Push: `git push origin vibes-diy@p0.X.Y vibes-diy@c0.X.Y` (add `vibes-diy@d0.X.Y` if deploying dev too)
5. Tags are immutable — never delete/move, bump the version instead

### Package publishes (`pkg@*`)

1. List existing tags: `git tag -l 'pkg@p*' --sort=-creatordate | head -5` (and `pkg@d*` for dev cadence)
2. Pick next sequential patch:
   - **prod:** e.g. `pkg@p2.0.8` → `pkg@p2.0.9`
   - **dev:** look up the latest `pkg@d<ver>-dev.N` and bump `N` (or bump `<ver>` and reset to `-dev.1` if the prior dev series just landed in prod). Never use `pkg@dev<ver>`.
3. Tag and push:
   ```
   git tag -a pkg@p2.0.9 -m "description"
   git tag -a pkg@d2.2.13-dev.4 -m "description"
   git push origin pkg@p2.0.9
   git push origin pkg@d2.2.13-dev.4
   ```
4. Tags are immutable — never delete/move, bump the version instead

## Say notification

`echo 'message' | say` is a **completion** signal — it must come after the deploy actually finishes, not after the action that kicks it off.

- ❌ Wrong: `git push origin vibes-diy@c2.2.X && echo 'c2.2.X deploying' | say` — the deploy hasn't run yet, CI takes minutes, the user gets a false "done."
- ✅ Right: push the tag → wait/poll `gh run list` until the run shows `completed success` → then `echo 'c2.2.X deployed' | say`.
- Word it as past tense (`deployed`, `published`, `green`), not progressive (`deploying`, `publishing`). The audible signal exists to call the human back when something they were waiting on is _done_.
- If the deploy fails, say something distinct (`deploy failed`) — never speak success on failure.

**Make it funny.** See [coding-standards.md § Say command timing & style](coding-standards.md). Every `say` opens with a different playful nickname (_captain_, _chief_, _king of the woods_, _deploy gremlin_, …) and lands the message in a goofy/unexpected way. Bare `'c2.2.X deployed' | say` is forbidden — that's a CI bot voice. Make the user chuckle. Examples:

- ✅ `echo 'oi shipmate, c2.2.47 has clocked in on cli — kick the tires' | say`
- ✅ `echo 'maestro, the bytes have crossed the rubicon, prod is green' | say`
- ✅ `echo 'uh oh space cadet, the deploy fizzled — check the logs' | say`
- ❌ `echo 'p2.2.47 deployed' | say`

### Canonical "wait for the deploy" command

For agents inside Claude Code: a deploy is a single completion event, so use **Bash with `run_in_background: true`** running an `until` loop that exits when the run lands on a terminal state. One notification, exits the moment it's done. Do **not** use the Monitor tool — Monitor is for streams and stays armed until timeout if the loop never exits.

```bash
TAG=vibes-diy@c2.2.X
until gh run list --repo VibesDIY/vibes.diy --branch "$TAG" --limit 1 \
  | grep -qE "completed[[:space:]]+(success|failure|cancelled|timed_out)"; do sleep 30; done
gh run list --repo VibesDIY/vibes.diy --branch "$TAG" --limit 1
```

When the background-task notification fires, read the final `gh run list` output, then `say` with past-tense language matching the actual outcome (`deployed` / `deploy failed`).

The same rule applies to npm publishes, package releases, queue drains — anything where the action you triggered runs asynchronously somewhere else.

## Pending changes

"Pending changes" = commits on `origin/main` that have not yet been shipped via the relevant deploy tag. There are three independent pending-change sets, one per tag stream:

- vs latest `vibes-diy@p*` — unshipped to prodv2
- vs latest `vibes-diy@c*` — unshipped to cli
- vs latest `pkg@p*` — unpublished to npm prod dist-tag (use-vibes / call-ai / vibes-diy CLI)

Each stream advances on its own cadence, so the three lists differ. To enumerate them:

```bash
LATEST_P=$(git tag -l 'vibes-diy@p*' --sort=-creatordate | head -1)
LATEST_C=$(git tag -l 'vibes-diy@c*' --sort=-creatordate | head -1)
LATEST_PKG=$(git tag -l 'pkg@p*'      --sort=-creatordate | head -1)
git log "$LATEST_P..origin/main"   --oneline   # pending → prodv2
git log "$LATEST_C..origin/main"   --oneline   # pending → cli
git log "$LATEST_PKG..origin/main" --oneline   # pending → npm
```

**Also factor the dev npm channel** when reporting on pkg. The latest `pkg@d*` tells us what's actually been exercised on npm short of prod — but only if it's an ancestor of `origin/main`. Dev tags are sometimes cut off-main (cherry-picks, pre-merge soaks) and later rebased in. Check explicitly:

```bash
LATEST_PKG_DEV=$(git tag -l 'pkg@d*' --sort=-creatordate | head -1)
git merge-base --is-ancestor "$LATEST_PKG_DEV" origin/main \
  && echo "ancestor — dev exercised everything up to $LATEST_PKG_DEV" \
  || echo "DIVERGENT — dev only exercised the cherry-picked tip, not the merge-base..main gap"
git log "$LATEST_PKG_DEV..origin/main" --oneline   # what's *not* yet on any npm channel
```

If the dev tag is divergent, the npm-exercised set is just the commits between its merge-base and its tip — not "everything up to that date." A divergent dev tag does **not** de-risk the rest of main; recommend cutting a fresh `pkg@d*` from current `origin/main` before promoting to `pkg@p*` if the gap is large or risky.

Use the phrase "pending changes" in user-facing summaries when reporting what would ship on the next tag of each stream.

**Always lead each commit list with a short narrative of the primary risks to shipping that stream now.** A pending-changes report is not just a `git log` dump — the value is the read on what could break. For each of the three streams, write a 1–3 sentence intro that calls out:

- The biggest blast-radius changes (prompt/preamble edits, queue/svc changes, schema migrations, CLI rename, package rename)
- WIP or revert-prone commits (`WIP …`, partial refactors, ones with follow-up fixes already in the list)
- Cross-stream coupling (e.g. cli already has it and looks fine → lower prod risk; or npm hasn't shipped a dep the prod code now imports)
- "Looks safe" is a valid risk verdict — say so explicitly when the diff is docs/spacing/comments only

Then **group commits by feature** (e.g. "Meta CAPI tracking", "Discord screenshots", "Asset perf") with a heading per group, and list the commits under each. Don't dump a flat chronological list — the grouping makes the feature surface area legible at a glance. The risk narrative goes _before_ the feature groups, not after.

## Queue architecture

One shared prod queue consumer for all environments. CLI and prod main workers both produce to `vibes-service-prod`. Dev has its own queue `vibes-service-dev`.

## Confirm before pushing prod tags

Never push a `vibes-diy@p*` (prod) tag without explicit user confirmation in the same exchange. Prod deploys are user-visible and not trivially reversible — even when the change is "obviously safe," wait for the human to say "go." This applies whether you're tagging from main, a PR branch, or a hotfix commit. CLI tags (`vibes-diy@c*`) carry the same weight when prod and cli ship together.

Tag language is also a deploy-tense rule: until CI confirms `completed success`, the work is **deploying**, not deployed. Use present tense (`deploying`, `shipping`) right after `git push origin <tag>`, switch to past tense only after the run reports success. See the "Say notification" section above for the full pattern.

## Pre-deploy checklist (rollback / verify / tail / success-shape)

Before tagging a prod deploy (or recommending one), articulate four things explicitly — don't ship a feature and stop at "PR is open":

1. **Rollback plan** — what's the one-line revert? Is there a faster `wrangler rollback` path if the new version is hard-down? What's the user-visible blast radius during the gap (which features degrade, do retries cover it)?
2. **Verification plan** — what concrete actions trigger the new code path? What do you check afterward (logs, DB rows, UI)? Include a "fallback path still works" check when the change is a dispatcher/router.
3. **Log-tailing readiness** — name the exact `wrangler tail` command (worker name + env) before deploy, not after. Confirm `observability.logs` is enabled in `wrangler.toml` for that env.
4. **Expected success shape** — what log lines land on the happy path? What error strings should you grep for on each known failure mode (auth, rate limit, missing secret, upstream-malformed)? If success is currently silent, add a structured Info log _before_ tagging — "no error" is a weak success signal in a queue worker.

The queue consumer only deploys on `vibes-diy@p*` tags — there is no staging dress rehearsal. Apply this checklist to any change touching `vibes.diy/api/queue/`, the queue-consumer step in `actions/deploy/action.yaml`, any worker without a dev/staging deploy, and to critical-path workers (svc/public, hosting) even when staging exists. When the user asks "are you ready to deploy?" treat it as a request for these four sections, not a yes/no.

## Don't guess Cloudflare account IDs

When `wrangler` returns a multi-account ambiguity error or `Authentication error [code: 10000]`, do **not** retry with a different account ID — even one wrangler itself listed. Stop, report the auth failure, and hand off to the user.

- Never swap `CLOUDFLARE_ACCOUNT_ID` between attempts to make a wrangler command succeed against prod.
- If `wrangler whoami` shows only one authorized account and the worker isn't there, treat that as "I cannot tail prod from this session" — don't keep guessing.
- Hand off: ask the user to run the tail locally, or point them at the Cloudflare dashboard live-logs UI for the worker.
- Same rule applies to other shared-infra IDs (R2 bucket account scoping, Workers AI account routing, etc.) — don't guess to bypass auth.
