# can-gate eval corpus — issue #2525 (RERUN 2: rows 3 & 6)

Final confirmation run for the [#2525](https://github.com/VibesDIY/vibes.diy/issues/2525)
A→B gate, after the **grant-doc-needs-a-channel** + **author-preservation** prompt fix
(PR #2527) landed on `main` and deployed. Only the two rows that FAILed in run 2
(`forum-mods`, `trip-planner`) were re-run; the other five are unchanged in
[`../can-gate-2525-rerun/`](../can-gate-2525-rerun/).

Generated `2026-06-22`, `vibes-diy@2.5.13`, handle `garden-gnome`. Prompt-under-test
confirmed deployed via `vibes-diy generate --dry-run --transcript`.

| dir            | row · dimension          | run1 → run2 → run3                                                                                                            |
| -------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `forum-mods`   | 3 · owner-managed roles  | PASS → FAIL → **SOFT-FAIL** ✅ appointment works (grant doc → `admin:mods`); nit: appoint gated on `isOwner` not `can.create` |
| `trip-planner` | 6 · shared collaboration | PASS → FAIL → **PASS** ✅ open collaboration, author-preserved, no unreadable grant doc                                       |

## Final 7-row result: **6 PASS / 1 SOFT-FAIL / 0 FAIL**, `unknown` 0, 0 hidden-write regressions

Progression across the three rounds:

- run 1: 3 PASS / 1 SOFT-FAIL / 2 FAIL (denom 6)
- run 2: 5 PASS / 0 SOFT-FAIL / 2 FAIL (denom 7)
- run 3: **6 PASS / 1 SOFT-FAIL / 0 FAIL (denom 7)**

**Verdict: the A→B gate passes — the flip is safe.** All three bugs the eval surfaced are
fixed at the prompt level and confirmed by regeneration:

1. public-read channels gated on `ctx.requireAccess` → fixed in #2526
2. grant/member docs returned with no channel ("unreadable write") → fixed in #2527
   (confirmed: `forum-mods`'s `modGrant` now routes to `admin:mods` and appointment works)
3. author reassignment on update → fixed in #2527 (confirmed: forum + trip preserve author)

The lone remaining SOFT-FAIL (`forum-mods` gating owner-management on `isOwner` display
rather than `can.create`) is a cosmetic anti-pattern, not a write blocker — a candidate
for a future prompt nudge, not a flip blocker.

Full detail:
[`docs/superpowers/specs/eval-2525-can-gate-results-2026-06-22-rerun2.json`](../../../docs/superpowers/specs/eval-2525-can-gate-results-2026-06-22-rerun2.json).

Generation note: `forum-mods` truncated/push-failed twice and is a recovered local
snapshot (content intact); `trip-planner` deployed clean. Server-side push failures
recurred every round — worth its own issue.
