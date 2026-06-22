# can-gate eval corpus — issue #2525 (RERUN on corrected prompt)

Re-run of the [#2525](https://github.com/VibesDIY/vibes.diy/issues/2525) A→B gate after
the `requireAccess`-vs-`public` + `allowAnonymous` prompt fix landed on `main`
(PR #2526). Same 7-row matrix, fresh slugs (`eval2525r-*`). Compare against the
first run in [`../can-gate-2525/`](../can-gate-2525/).

Generated `2026-06-22` with `vibes-diy@2.5.13`, handle `garden-gnome`. Prompt-under-test
confirmed deployed via `vibes-diy generate --dry-run --transcript`.

| dir              | row · dimension          | prior → now                            |
| ---------------- | ------------------------ | -------------------------------------- |
| `recipe-journal` | 1 · owner                | PASS → **PASS** (now renders reason)   |
| `team-board`     | 2 · channel / open board | **FAIL → PASS** ✅ open-channel fix    |
| `forum-mods`     | 3 · owner-managed roles  | PASS → **FAIL** ⚠️ new bug             |
| `guestbook`      | 4 · anonymous writes     | **SOFT-FAIL → PASS** ✅ allowAnonymous |
| `photo-wall`     | 5 · comments             | **FAIL → PASS** ✅ open-channel fix    |
| `trip-planner`   | 6 · shared collaboration | PASS → **FAIL** ⚠️ new bug             |
| `task-list`      | 7 · per-doc edit/delete  | flake → **PASS** ✅ composer generated |

Roll-up: **5 PASS / 0 SOFT-FAIL / 2 FAIL** (denominator 7), `unknown` 0 — up from
3 PASS / 1 SOFT-FAIL / 2 FAIL (denom 6) in the first run.

**The targeted bug is fixed.** Every open-channel / anonymous app recovered: the model
now writes `grant.public` for read and gates writes on the author (no `ctx.requireAccess`
on open channels), and uses `allowAnonymous: true` for "anyone can sign" prompts.

**One new, isolated bug remains** in the two role-management apps (forum-mods,
trip-planner): grant / role-grant / member docs are returned **without a channel**, so the
server rejects them as **"unreadable write"** (`access-function.ts` `isReadableResult`,
`app-documents-write-eventos.ts:366`) — and the role→`requireAccess` round-trip never
completes. This is inherited from the prompt's `roleGrant` / survey-config examples, which
also omit the channel. Next prompt fix: every grant/member doc must also route to a
channel, and the restricted-channel example should be end-to-end (writable grant doc +
gated grant UI).

Full per-vibe detail:
[`docs/superpowers/specs/eval-2525-can-gate-results-2026-06-22-rerun.json`](../../../docs/superpowers/specs/eval-2525-can-gate-results-2026-06-22-rerun.json).

Generation note: 4 of 9 generate attempts push-failed server-side and 1 lint-failed this
round; `recipe-journal`, `team-board`, `photo-wall` are recovered local snapshots
(content intact, did not deploy). Transient server-side issue, independent of content.
