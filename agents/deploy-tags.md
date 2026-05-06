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

Convention: `pkg@d2.0.0-dev-cli-<letter>` for dev CLI iterations.

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

1. List existing tags: `git tag -l 'pkg@p*' --sort=-creatordate | head -5`
2. Pick next sequential patch: e.g. `pkg@p2.0.8` → `pkg@p2.0.9`
3. Tag and push:
   ```
   git tag -a pkg@p2.0.9 -m "description"
   git push origin pkg@p2.0.9
   ```
4. Tags are immutable — never delete/move, bump the version instead

## Say notification

`echo 'message' | say` is a **completion** signal — it must come after the deploy actually finishes, not after the action that kicks it off.

- ❌ Wrong: `git push origin vibes-diy@c2.2.X && echo 'c2.2.X deploying' | say` — the deploy hasn't run yet, CI takes minutes, the user gets a false "done."
- ✅ Right: push the tag → wait/poll `gh run list` until the run shows `completed success` → then `echo 'c2.2.X deployed' | say`.
- Word it as past tense (`deployed`, `published`, `green`), not progressive (`deploying`, `publishing`). The audible signal exists to call the human back when something they were waiting on is _done_.
- If the deploy fails, say something distinct (`deploy failed`) — never speak success on failure.

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
