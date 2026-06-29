# Low-risk *because* high-velocity: 270 PRs in 17 days, and the dial that made it safe

Source: `claude/git-diff-stats-june-12-syaw73` (PR-level churn analysis, June 12–29 window)

Pulled the stats on the PRs merged between June 12 and 29 — **270 as of the analysis snapshot
(midday June 29), ~223k lines of churn, a median PR of 196 lines / 5 files merged in a median
0.8 hours** (80% landed in under six hours). A few more merged later that same day (the window
kept filling as the analysis ran — itself a data point), so pin the headline to the snapshot
rather than claiming "all"; percentages are computed over the 270. 95% were agent-authored; one human, jchris, merged 261 of them. The surprise wasn't
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
existed as one terrifying PR.

Two deeper threads the founder/indie cut should lead with. **(1) The real bottleneck was never
the code — it was focus.** jchris's framing: "I would not have been able to maintain focus for
these tasks; the agent holds the context, and I dip in when decisions are required, so I can
shepherd a flock of workstreams without the risk that comes from fractured focus." The agent
absorbs the context-switch tax, so you get the throughput of many parallel threads without the
attention-splitting risk. The hard part of building was always *deciding what matters*, not
typing. **(2) The tools improve on demand, and that's why the speed compounds.** The `agents/`
directory is the evidence — 22 docs touched in the window, new ones pulled into existence by real
walls: `github-mcp-limits.md` (slim `gh-runs.sh` wrapper, #2640, June 25), `cloud-browser-setup.md`
+ `authed-browser-debugging.md` (chrome-devtools MCP screenshots out-of-the-box in cloud sessions,
June 28), `identity-ship-verify.md` (headless `DEVICE_ID` prod-verify round-trip, June 29). The
forcing function was getting everything to run in **cloud sessions** — started as a latency hack
(jchris on a Greek island, codebase across an ocean), became the way of working: most work now
ships from a phone at the beach, *faster and better*, because using the product under real-world
conditions calls forth the next improvement without breaking stride.

The trade-off/gotcha: this only works if slices are *independently shippable* (the
`vibeApi ?? chatApi` fallback, flags-default-off, spec-first design PRs before code) and if every
tool improvement is demand-driven and written down — slicing without that discipline just gives
you 270 ways to half-break prod, and speculative tooling just burns the time the slicing saved.
