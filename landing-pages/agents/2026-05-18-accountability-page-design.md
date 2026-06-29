# Design: Accountability Partnership Page

**Date:** 2026-05-18  
**Scope:** New audience page `src/pages/accountability.hbs` — five apps mapping the dating-app UI patterns onto accountability partner matching.

## Concept

The accountability partner relationship is one of the most reliably effective behavioral tools we have, yet entirely coordinated today via Reddit threads, casual text asks, and expensive coaching. The matching axes are different from romance: goal + intensity + schedule + accountability style + failure tolerance. Once you identify those axes, the product shape is obvious — and nobody has shipped it.

The five dating patterns (Season, Vouched, Slot, Letters, Foursome) translate almost directly:

| Dating | Accountability |
|--------|---------------|
| Season | **Cohort** — 20 people with the same goal for a fixed month |
| Vouched | **Staked** — a friend who knows you vouches you're serious |
| Slot | **Post** — post the goal slot, not the profile |
| Letters | **Letters** — one slow async message per day |
| Foursome | **Pod** — 4-person group first; 1-on-1 emerges after |

## Page Details

**File:** `src/pages/accountability.hbs`  
**URL:** `/accountability.html`  
**Layout:** `webring` (custom chrome)  
**Source tag:** `accountability`

### Visual Skin: "Ledger"

Warm and purposeful — contrasts with the dark romanticism of dating and the raw concrete of college.

- `--parchment: oklch(0.96 0.02 80)` — warm off-white background
- `--forest: oklch(0.38 0.10 145)` — deep moss green accent (commitment, growth)
- `--forest-light: oklch(0.52 0.10 145)` — lighter green for hovers
- `--black: oklch(0.10 0 0)`
- `--muted: oklch(0.55 0 0)`
- Fonts: DM Serif Display (display headings) + Inter (body) + JetBrains Mono (labels/meta)

Structure follows college.hbs: topbar → breadcrumb → hero → stats bar → section label → apps list (column) → epilogue → footer.

## Apps

```json
[
  {
    "num": "01",
    "slug": "goal-cohort-match",
    "title": "Cohort",
    "tagline": "Twenty strangers, one goal, one month.",
    "desc": "20 people all trying to change the same thing join a fixed-length cohort. Daily check-ins, weekly group calls, pair off into 1-on-1 partnerships naturally or don't. The cohort closes at the start. Finishers recruit the next round — 'I quit sugar in Cohort 3.'"
  },
  {
    "num": "02",
    "slug": "accountability-vouched",
    "title": "Staked",
    "tagline": "You can't join. Someone has to stake their reputation on you.",
    "desc": "An existing user vouches you're serious; their credibility score drops if you ghost. Every partner sees 'introduced by [name], who has staked 4 others, all still going.' The network is the trust graph of all vouchers. Ghosting costs both of you."
  },
  {
    "num": "03",
    "slug": "goal-slot-board",
    "title": "Post",
    "tagline": "Post the goal, not the profile.",
    "desc": "'Quit sugar, 30 days, one partner, starts Monday.' People claim open goal slots, not profiles. After the first week, both decide to continue or part cleanly. Unclaimed slots expire. The goal itself is shareable outside the app."
  },
  {
    "num": "04",
    "slug": "slow-accountability-letters",
    "title": "Letters",
    "tagline": "One message per day. No rush, no ghosting.",
    "desc": "Write to one partner at a time, long-form, about the real thing — the fear, the why, the small wins. Rate-limited to one message per day. Day 14 prompt: 'what does failing look like, and what do you want me to do?' The letters become the archive of the change."
  },
  {
    "num": "05",
    "slug": "accountability-pod",
    "title": "Pod",
    "tagline": "The 1-on-1 comes after the pod.",
    "desc": "1-on-1 partnerships only form after a week inside a four-person pod with the same goal. First contact is always the group. Pods dissolve into pairs or stay whole — the group decides. Pods recruit new members; that is how the network grows."
  }
]
```

## Index Card

Add to `src/pages/index.hbs` before the dating card:
- Class: `accountability`
- Accent: `#2D7A4F` (forest green)
- Icon: `⟳` (accountability/cycle)
- CTA: "Find Your Partner →"

## Runbook Location

`vibes/accountability/_run.sh` — uses `--user-slug=og`, backgrounds each generate call.
