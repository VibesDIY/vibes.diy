# cli-then-prod — stage on CLI, verify, then promote

The standard runbook for shipping anything that benefits from a verify step before prod (db schema migrations, queue-consumer changes, anything where rollback is not free). Uses the existing `vibes-diy@c*` / `vibes-diy@p*` tag convention from [deploy-tags.md](deploy-tags.md).

## Procedure

1. **Tag `@c`** on the PR branch's HEAD commit. Pick the next sequential `c2.X.Y` per [deploy-tags.md](deploy-tags.md).
2. **Wait** for the CI deploy to land on `completed success`. Use the canonical `until gh run list ... | grep -qE "completed[[:space:]]+(success|...)"` loop in background (see [deploy-tags.md](deploy-tags.md) "Canonical wait-for-the-deploy command").
3. **Verify** on CLI env with whatever the change actually changes:
   - DB schema → `wrangler d1 execute ... --command="select * from sqlite_master where name='<table>'"` or equivalent inspect.
   - Handler → curl / cli command exercising the path.
   - Queue / worker → tail logs, fire a test event.
4. **Merge** the PR to main only after CLI is verified green. Rebase, don't squash (per repo policy).
5. **Tag `@p`** on the merge commit on main. Same version number as the `@c` tag.
6. **Wait** for the prod deploy to land. Same background-loop pattern.
7. **Say** past-tense (`deployed`) on success, distinct message (`deploy failed`) on failure. Never speak success on failure.

## Why CLI first

CLI env is wired to the same prod queue and shares prod-equivalent infrastructure, but it's not user-visible on the main vibes.diy origin. So a broken CLI deploy degrades a small surface (CLI users, tests against CLI hosts) rather than every visitor. It's the closest thing to staging that exists in this repo.

## When to skip

- One-line text/doc fixes where verification is just "the file changed."
- Pure client-side changes that don't touch the api/queue.
- Hotfixes where the CLI delay is worse than the rollback risk — but state that explicitly and have the rollback plan ready.
