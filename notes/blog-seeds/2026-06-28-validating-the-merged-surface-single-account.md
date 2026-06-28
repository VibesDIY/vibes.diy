# Validating a merged epic with one account and a screenshot-only browser

Source: #2795 (agent-in-vibe validation pass), branch `claude/validate-2795-q59q5o`.
Driven from a Claude Code cloud session: Clerk sign-in-token login → Playwright over the
exported session, plus the already-logged-in `vibes-diy` CLI.

Goal: drive the merged agent-in-vibe surface (#2676/#2677/#2678/#2679/#2680/#2772/#1856)
like a real user and cross-check via CLI, on desktop and mobile, before declaring the epic done.

Findings worth a full post:

- **The authed-browser recipe stops at screenshots — real validation needs to *click*.**
  `clerk-authed-shot.mjs` navigates + shoots; it can't grow the card or open Share. The fix was a
  ~90-line Playwright driver reusing the exact same `--storage` session and the same cloud launch
  args (cloud Chromium, proxy, `--no-sandbox`, `--ssl-version-max=tls1.2`). Worth documenting the
  boilerplate + the card's stable `aria-label` selectors so the next agent doesn't reverse-engineer
  them from `UnifiedVibeCard.tsx`. (Folded into `agents/authed-browser-debugging.md`.)

- **`networkidle` is the wrong wait for the `/vibe/` card route.** Some vibes hold a long-lived
  connection, so the page never idles and `goto(..., networkidle)` times out at 60s
  (`/vibe/.../to-do` did; `bouncing-div` didn't). `domcontentloaded` + a settle is the right wait —
  and it means `clerk-authed-shot.mjs`'s default can silently "fail" on exactly the surface you're
  trying to QA.

- **The published CLI lags `main`, and the checklist doesn't warn you.** `vibes-diy versions`
  (shipped in #2772 D3, present at `main.ts:144`) isn't in `npx vibes-diy@latest` — you get
  "Not a valid subcommand name" and could wrongly conclude the feature regressed. Validating a
  just-merged CLI feature means running the repo-local CLI, not the published binary.

- **The real wall is the second account.** Half of #2795 (non-owner seamless fork, "it's yours now"
  toast, member/anonymous share-roster variants) needs a genuinely separate account B. `qa-pr` and
  the authed-browser recipe both sign in as the single operator identity, and nothing documents how
  to seed a second QA identity. The trade-off: one-account + screenshot-only gets you render/load +
  CLI deep-read coverage and an honest "affordances present," but the *live* state-machine flows
  (in-place generation stream, publish, fork lineage) stay unverified until there's a B.
