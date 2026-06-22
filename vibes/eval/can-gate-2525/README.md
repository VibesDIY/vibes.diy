# can-gate eval corpus — issue #2525

A→B gate for the `useVibe().can` prompt flip (generation QA). One generated vibe per
row of the [#2525](https://github.com/VibesDIY/vibes.diy/issues/2525) prompt matrix,
pulled here so a regression is a diff. Each dir holds the generated `App.jsx` +
`access.js` (+ `README.md`).

Generated `2026-06-22` with `vibes-diy@2.5.13` under handle `garden-gnome`.

| dir | matrix row · dimension | grade |
|---|---|---|
| `recipe-journal` | 1 · single-author / owner | PASS |
| `team-board` | 2 · channel membership | PASS |
| `forum-mods` | 3 · owner-managed roles | PASS (best example) |
| `guestbook` | 4 · anonymous writes | SOFT-FAIL (login-required, no `allowAnonymous`) |
| `photo-wall` | 5 · comments | SOFT-FAIL (channel bootstrap on `isOwner`) |
| `trip-planner` | 6 · multi-database | PASS (collapsed to one db) |
| `task-list` | 7 · per-doc edit/delete | FAIL (stubbed create surface) |

Full per-vibe grades, criteria, and the roll-up:
[`docs/superpowers/specs/eval-2525-can-gate-results-2026-06-22.json`](../../../docs/superpowers/specs/eval-2525-can-gate-results-2026-06-22.json).

The `unknown` rate is 0 by static analysis of the client runner
([`vibes.diy/vibe/runtime/access-runner.ts`](../../../vibes.diy/vibe/runtime/access-runner.ts)):
an `unknown` verdict fires only on async access fns, non-extractable exports (named
arrow-const), compile errors, or unimplemented `ctx` members — none present in this
corpus (all exports are extractable named/​default functions whose name matches the db,
and `ctx.requireAccess`/`ctx.requireRole` are both implemented).
