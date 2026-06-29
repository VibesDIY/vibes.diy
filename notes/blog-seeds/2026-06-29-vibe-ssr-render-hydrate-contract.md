# The render+hydrate seam that makes vibe SSR a drop-in later

Source: `claude/comment-2802-t48i1h` (#2802, slice 1)

Cloudflare Dynamic Workers (the `env.LOADER` Worker Loader, open beta) quietly invalidated
the headline conclusion of #2802 — that true per-request SSR of untrusted vibe code "can't run
on a Worker" because of the no-`eval` wall. It can now: a fresh V8 isolate, code supplied at
request time, bindings + `globalOutbound` injectable, which is also the answer to the part
jchris flagged (SSR has to run the vibe's live Fireproof queries to quiescence so blog
articles actually render server-side, not just the shell).

But the executor half (which isolate, which runtime) isn't unit-testable in CI — the binding
is beta and absent. So the sharp move was to split the feature at its natural seam and build
only the half that *is* pure and testable: `renderVibeToString(comps, props)`, the server
twin of `mountVibe`. The trick that makes the rest a drop-in is a single shared
`buildVibeTree(comps, props)` used by both — so the server markup and the markup the client
hydrates are byte-identical *by construction*, not by two code paths that have to be kept in
sync. `mountVibe` then upgrades from "always `createRoot().render()`" to "`hydrateRoot` when
the container already holds server markup, else `createRoot`" — the issue's "hydrate, don't
re-render" acceptance item, in three lines.

Two gotchas worth keeping:

- **React 19 hydration is concurrent.** A `setTimeout(0)` flush races it; asserting node
  identity (`querySelector('button')` is the *same* node after mount) only works if you wait
  on a real commit signal — an effect that flips a flag, awaited via `vi.waitFor`. The earlier
  timer-based version intermittently caught React mid-hydration, which then "switched the
  entire root to client rendering" and replaced the node.
- **Module-level `activeRoot` + `isolate:false` = state bleed.** When a test left a
  half-hydrated root and teardown's `unmount()` threw, the handle never cleared and the *next*
  test rendered into a detached root (empty DOM, baffling failure). Fix doubled as a real
  hardening: `unmountVibe` now clears the handle *before* calling `unmount()`, so a throwing
  teardown can't strand the next mount. This is the #1515 state-bleed class biting in
  miniature.
