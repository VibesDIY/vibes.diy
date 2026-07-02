# The ship button: turning a tag ritual into one tap (without giving up the decision)

Source: `.github/workflows/ship-fanout.yaml`, `agents/deploy-tags.md`

Started as a "should we just auto-deploy from main?" conversation. The trade-off analysis
killed that idea for this repo: agents autonomously merge garden-variety PRs to main here,
so merge and ship are deliberately different events — auto-deploy would make every
Dependabot merge a prod deploy, erase main-as-staging-buffer, and slow rollback (a revert
commit is a fresh SHA with no green `compile_test` check, so it waits for the full suite,
while retagging an old green SHA skips straight to deploy).

But the actual pain wasn't tags, it was *creating* one: you need a device with a git
checkout, or the Releases-UI dance. The fix was one job: `workflow_dispatch` on
`ship-fanout.yaml`. The dispatch job creates and pushes the `ship@` tag itself using the
`DEPLOY_TAG_PAT` the workflow already held — and that tag push fires the existing,
untouched push path (validate → test-once → fan out three child tags). Shipping is now a
tap in the GitHub app, or an MCP `actions_run_trigger` call from a Claude session after a
human "ship it". Control stays human; logistics go to zero.

The interesting bits for a post:

- **Auto-versioning by scanning the tag namespace.** No version file, no bump commit: the
  job takes the highest bare-semver across all four streams (`ship@`, `vibes-diy@p`,
  `vibes-diy@c`, `pkg@p`) and increments the patch — the repo's
  "align-versions-across-streams" rule, automated. The tag stream is already the version
  database; you just have to query it (`sed | grep | sort -V | tail -1`).
- **Self-triggering as a feature.** Dispatch run creates the tag; the tag triggers a
  second run of the *same workflow* that does the real work. Two runs feels redundant
  until you notice it means the dispatch path inherits every validation of the manual
  path for free, and the "GITHUB_TOKEN pushes don't trigger workflows" footgun is dodged
  by reusing the PAT that existed for exactly that reason.
- **The `always()` trap.** Adding an event guard to `gate` wasn't enough: `compile_test`
  runs under `always()`, so on dispatch runs it would start anyway, see gate skipped, and
  fail closed — a red X on every successful dispatch. Any job with `always()` needs its
  own event guard when a workflow grows a second trigger.
- Racing double-taps are handled by the existing per-ref concurrency group: the second
  dispatch queues, then recomputes its version after the first's tag exists.
