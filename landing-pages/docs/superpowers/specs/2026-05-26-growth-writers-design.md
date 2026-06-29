# Design Spec: growth-writers Audience Page

**Date:** 2026-05-26  
**Slug:** `growth-writers`  
**Playbook:** `agents/full-audience-playbook.md`

---

## Audience

People who do bulk content generation at scale — product marketers, editorial ops teams, agency content leads, systematic publishers — who identify (or wish they identified) as growth-minded writers rather than content operations workers.

**What to never say:** SEO, search traffic, rankings, keyword research. The page speaks to the aspiration, not the tactic.

---

## Identity / Tone

**The Leverage Seeker** — but ironic and self-aware.

The copy acknowledges the gap between "I'm building a compounding content engine" (the aspiration) and "I'm briefing a contractor about refrigerator repair guides at 11pm" (the reality). Warmly, not mockingly. The audience will recognize themselves and feel seen.

Irony shows up in:
- Taglines that name the absurdity ("So you can explain to yourself why publishing your 9th article on email subject lines was 'strategic.'")
- The epilogue winking at the elephant in the room without naming it ("You know what these tools are really for.")
- App descriptions that are functional but not solemn

The page never punches down or makes the audience feel embarrassed. The joke is shared, not at their expense.

---

## Visual Skin

**Recon Grid** — GitHub-dark palette, intelligence-ops meets data dashboard.

- Background: `#0d1117`
- Raised surfaces: `#161b22`
- Borders: `#21262d` / `#30363d`
- Accent: `#58a6ff` (blue), `#3fb950` (green for "live" / clone CTA)
- Text: `#e6edf3` (primary), `#8b949e` (muted)
- Font: Inter (UI) + no serif — clean, analytical, slightly cold

This deliberately contrasts with `creators.hbs` (Vault/amber dark). Same dark-bg energy, different color temperature — blue-cool vs amber-warm.

---

## Page Structure

```
slug:   growth-writers
layout: webring
title:  "For Growth Writers | Vibes DIY"
desc:   "Five strategy tools for systematic publishers — AI brief generation, topic cluster mapping, idea scoring, audience segmentation, and compound tracking. Open source. Clone any of them."
ogUrl:  https://good.vibes.diy/growth-writers/
source: growth-writers
```

### Hero

Label pill: `For Growth Writers`

Headline:
> You have a content strategy.  
> *It's just in your head.*

Subtext: Five tools for the people who care about compounding content, topic clusters, and systematic publishing — and who definitely aren't going to say *that other word*. Open source. Clone any of them. Make them yours.

CTA: `Open the Brief Factory →` (links to spotlight app)

### Stats bar (4 cells)
- Apps: Five
- Stack: Strategy
- Skin: Recon Grid
- Audience: Growth Writers

### Spotlight — Brief Factory (№01)

**The AI brief generator, powered by callAI.**

- Input: topic + target reader (plain text)
- Output: structured brief — angle, key points, what to avoid, word count recommendation, CTA suggestion
- Uses `callAI` for generation
- Tagline: *"You've written this brief 40 times. Now you don't have to."*
- Fork hint: "Swap the brief format for your own template. Add a tone-of-voice field. Make it match your editorial standards."

This is the "wow" moment — immediately useful, demonstrates the platform's AI capability, and the fork hint is credible.

### Gallery Apps (№02–05)

**№02 — The Cluster Map**
- Topic pillars + coverage status
- Mark topics as published / in queue / missing
- Tagline: *"Topic pillars, coverage status, and the gaps."*
- Editorial: "So you can explain to yourself why publishing your 9th article on email subject lines was 'strategic.'"
- Theme: `broadsheet`

**№03 — Idea Tribunal**
- Topic backlog scoring + prioritization
- User-defined criteria; stack-rank to pick what to write this week
- Tagline: *"Twelve ideas enter. One gets written this week."*
- Editorial: "Score them by criteria you made up. The winner gets written. The rest wait."
- Theme: `proof`

**№04 — Reader Segments**
- Map topic ideas to audience types
- Prevents "writing for everyone" drift
- Tagline: *"Who, specifically, are you writing for?"*
- Editorial: "Stop writing for everyone and start writing for someone. Clone it for your client roster."
- Theme: `atlas`

**№05 — The Compound View**
- Track how pieces reference and build on each other
- Internal link map + cluster membership
- Tagline: *"Track how your pieces build on each other."*
- Editorial: "Every piece that links to another piece. Every topic that supports a cluster. Compounding content, not just content."
- Theme: `carbon`

### Epilogue

> You know what these tools are really for. We know too. We're just not going to say it — because the point isn't the traffic, it's the system. *Clone whichever one is closest to how you already think.* Open source — make it yours.

### Footer
Links: homepage · discord · expressions · creators

---

## App Generation

All apps use `--user-slug=og`. Script at `vibes/growth-writers/_run.sh`.

| Slug | Theme | Notes |
|---|---|---|
| `ai-content-brief` | `recon` | callAI — spotlight; brief format output |
| `topic-cluster-map` | `broadsheet` | Coverage status per topic; no fantasy vocab needed |
| `idea-scoring-board` | `proof` | Criteria-based stack ranking |
| `reader-segment-mapper` | `atlas` | Topic × audience matrix |
| `content-compound-tracker` | `carbon` | Link graph / cluster membership |

**callAI note:** The spotlight app (`ai-content-brief`) needs to import `callAI` and use it to generate brief text on form submit. The prompt should take `topic` and `targetReader` inputs and return a structured brief. No hardcoded API keys — callAI handles the auth.

**Theme vocabulary:** `broadsheet` and `proof` produce plain editorial copy, which fits. `atlas` may produce geographic metaphors — add "Use plain, direct language. No map/territory vocabulary." to the prompt if needed.

---

## Ad Variants (3)

### Ad 1 — The Systematic Publisher (30–50, content marketing leads, newsletter operators)
- Headline: `"You've written this brief 40 times."`
- Body: `"AI generates your content brief in 8 seconds. Topic cluster maps, idea scoring, audience segmentation. Open source — make it yours."`
- Interests: Content marketing, Newsletter, HubSpot, Substack

### Ad 2 — The Growth Writer (25–40, solo growth ops, startup content leads)
- Headline: `"Your content strategy lives in your head."`
- Body: `"Five tools to get it out. Brief factory, cluster map, idea tribunal. Customize it for your system. Open source."`
- Interests: Growth hacking, Content strategy, Startup, Marketing automation

### Ad 3 — The Agency Operator (30–50, agency content leads, freelance content strategists)
- Headline: `"Brief your writers in 8 seconds."`
- Body: `"AI briefs, topic cluster maps, audience segmentation. Clone any tool and make it yours. Open source."`
- Interests: Content agency, Freelance writing, Digital marketing, Copywriting

---

## Indexes to Update

- `src/pages/index.hbs` — add card (newest first)
- `src/pages/about.hbs` — add card

---

## Checklist (from playbook)

```
[ ] Audience analysis complete
[ ] 5 app concepts defined, Brief Factory designated spotlight
[ ] Theme picked per app (no two share the same)
[ ] vibes/growth-writers/_run.sh created and run
[ ] All apps verified: fsId is real CID, not "pending"
[ ] src/pages/growth-writers.hbs built, spotlight-first
[ ] Wired into index.hbs and about.hbs
[ ] pnpm check passes
[ ] _site/growth-writers.html opens, screenshots load
[ ] OG screenshot captured (≥10KB)
[ ] ogImage added to frontmatter, pnpm check re-run
[ ] pnpm check + prettier, git commit
[ ] OG screenshot uploaded to Meta, image hash captured
[ ] 3 ads created ACTIVE at $10/day
[ ] Interest IDs looked up, targeting set per ad set
[ ] All 9 objects confirmed ACTIVE via API
[ ] agents/handoff-growth-writers-ads.md created
```
