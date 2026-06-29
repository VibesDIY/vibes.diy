# Low-risk *because* high-velocity: 270 PRs in 17 days, and the dial that made it safe

Source: `claude/git-diff-stats-june-12-syaw73` (PR-level churn analysis, June 12–29 window)

Pulled the stats on every PR merged between June 12 and 29: **270 of them, ~223k lines of
churn, a median PR of 196 lines / 5 files merged in a median 0.8 hours** (80% landed in under
six hours). 95% were agent-authored; one human, jchris, merged 261 of them. The surprise wasn't
the volume — it's that velocity and safety weren't in tension, they were the *same property*.
The median PR is tiny because big work got sliced: 18% of titles literally say
*slice/phase/step/bucket*, 29% reference a parent issue, and the scary churn is quarantined into
~6 obviously-mechanical sweeps (the top 10 PRs are 53% of all churn; strip them and the typical
change is a couple hundred lines you can read in one sitting). The human element isn't
gatekeeping — it's *shepherding*: choosing where to go and **how carefully to tread, dialed to
risk and reward**. Same person, same day, opposite caution settings: #2827 (sidebar links →
`/vibe` route) shipped hot in 25 minutes with no flag because the blast radius was a string
prefix; #2837 shipped the first new-vibe-builds-on-`/vibe` flow on, but only after an E2E
preview run and a Codex P1 fix; #2835 (vibe SSR) landed *dormant behind a flag* with production
explicitly `off`; and #2494 carried a hand-written hold — *"do not merge until after the next
prod deploy of main, so the change deploys in isolation and any regression is unambiguously
attributable."* The post worth writing: for an indie builder, **high velocity is the
risk-control mechanism, not the thing you trade against it** — small revertible slices + a human
turning a caution dial per-PR beats big-bang merges guarded by hope. Three migrations prove it
(retiring `/chat` for the `/vibe` route, de-fireproofing identity, and building the eval
harnesses that let prompt/model changes be measured instead of guessed), and none of them ever
existed as one terrifying PR. The trade-off/gotcha: this only works if slices are *independently
shippable* (the `vibeApi ?? chatApi` fallback, flags-default-off, spec-first design PRs before
code) — slicing without that discipline just gives you 270 ways to half-break prod.
