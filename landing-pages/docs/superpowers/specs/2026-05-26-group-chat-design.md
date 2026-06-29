# Group Chat Page — Design Spec
_2026-05-26_

## Overview

New audience page at `/group-chat/` showcasing four apps that let anyone remix their group chat experience. Theme: **"Make it yours"** — every app is open source, forkable, and customizable. The page follows the full-audience-playbook end-to-end: generate apps → double upgrade cycle → build page → ads ACTIVE.

---

## Skin

**Hot Chat** — amber goldenrod neobrutalist.

| Token | Value |
|---|---|
| Background | `#fffbeb` (ivory-amber) |
| Accent | `#fbbf24` (goldenrod) |
| Accent dark | `#d97706` |
| Borders | `3px solid #000` |
| Shadow | `3px 3px 0 #000` |
| Hero bg | `#fbbf24` |
| Mood Board bg | `linear-gradient(135deg, #1c1917, #292524)` |
| Headline font | Alte Haas Grotesk (matches main site) |
| Body font | Inter |

---

## Apps

| # | Slug | Title | Role |
|---|---|---|---|
| 01 | `group-reply-picker` | Reply Roulette | Lead app (no "spotlight" label) |
| 02 | `pirate-chat-filter` | Pirate Mode | Gallery |
| 03 | `colbert-room` | Colbert's Here | Gallery |
| 04 | `ambient-chat-art` | Mood Board | Full-width bottom hero |

All generated with `--user-slug=og`. Each gets a distinct theme (no two apps share the neobrutalist default).

---

## Page Structure

### 1. Nav
Logo left, `← all tools` right. `#fffbeb` bg, `2px solid #000` bottom border.

### 2. Hero
- Background: `#fbbf24`
- Badge: `MAKE IT YOURS` (black pill, goldenrod text)
- Headline: **"Your group chat. Your rules."**
- Subtext: "Four tools that remix how your group talks. Open source — clone any of them."
- CTAs: `TRY REPLY ROULETTE` (black fill) + `SEE ALL APPS ↓` (outline)

### 3. Reply Roulette section
- No "spotlight" label — just leads naturally after the hero
- Tagline: **"Four AI replies, ranked from smart to saucy."**
- Body: "Pick one, write your own, or flip on auto mode and let two people have a whole conversation without typing a word."
- Preview block showing the A→D spectrum:
  - **A** — polite/thoughtful
  - **B** — agreeable
  - **C** — "I respect the chaos."
  - **D** — "Absolutely unhinged, I'm in."
- Screenshot + JOIN / CLONE / REMIX links

### 4. More Mods gallery (2-column)
- **Pirate Mode ☠️** — "Every message, rewritten in pirate."
- **Colbert's Here 🎙️** — "The man himself weighs in on your thread."
- Each card: border + offset shadow, screenshot, JOIN · CLONE · REMIX

### 5. Mood Board — full-width bottom hero
- Dark bg (`#1c1917 → #292524`), golden type
- Label: `AMBIENT`
- Headline: **"Mood Board"**
- Body: "Your last few messages become an image. The vibe, visualized. Refreshes as the conversation moves."
- 3-across generated image samples (gradient placeholders until live)
- JOIN + CLONE IT buttons

### 6. CTA footer
- Black bg, goldenrod text
- "Build your own mod →"
- "Start from any of these or prompt from scratch on vibes.diy"

---

## App Prompts (generation)

> **Prompt length rule:** These draft prompts are in the 50–80 word middle-ground — too long to be brief, too short to be detailed. Before running the CLI, either trim each to under 50 words OR expand to 500–1000 words with a full spec. Don't generate from these as-is.

### group-reply-picker
Draft: "Reply Roulette — given the last message in a group chat, generate four replies ranked from smart to saucy (A = thoughtful and articulate, D = chaotic and unhinged). Optional: the user can type their own message first — it either gets posted directly or used to replace/refine the AI suggestions before sending. Auto mode: two users can take turns having the app pick their reply automatically, running a full conversation without either person typing."

### pirate-chat-filter
Draft: "Pirate Mode — paste in a message, get back a pirate translation. Shared session: everyone's messages appear in the original and pirate version side by side. One tap to copy the pirate version back to your real chat."

### colbert-room
Draft: "Colbert's Here — drop your group chat topic or a recent message. Get a Stephen Colbert-style hot take: a short satirical monologue with a punchline. Works on anything — dinner plans, relationship drama, sports arguments."

### ambient-chat-art
Draft: "Mood Board — reads the last few messages from the group (pasted in), generates an ambient image prompt that captures the current vibe, and displays the image full-width. Refreshes every few minutes as the conversation evolves. The image should be non-literal — color field, texture, mood — not a scene illustration."

---

## Upgrade Cycle

After all 4 apps are generated and fsId is verified (not "pending"):

1. **Round 1** — parallel upgrade loop: screenshot → identify issues → fix App.jsx → push → verify
2. **Round 2** — second pass on all 4 apps

Use the procedure in `agents/parallel-upgrade-loop.md`. All 4 apps in one agent batch (small enough to not need 8-agent split — use 2 parallel agents: Reply Roulette + Pirate Mode in one, Colbert + Mood Board in the other).

---

## Ads (3, ACTIVE at $10/day)

**Default: always ACTIVE.** See `agents/full-audience-playbook.md` Phase 11.

| Ad | Sub-audience | Headline direction |
|---|---|---|
| 1 | Group chat admins / heavy texters | The coordination angle — "who's replying, what do I say" |
| 2 | People who hate being the first to reply | Auto mode hook — "talk without talking" |
| 3 | Group chat entertainers | Chaos angle — pirate mode / Colbert |

---

## Checklist

```
[ ] App prompts written (above)
[ ] 4 apps generated via CLI with --user-slug=og
[ ] All 4 fsId verified (real CID, not "pending")
[ ] Upgrade round 1 complete (all 4 apps)
[ ] Upgrade round 2 complete (all 4 apps)
[ ] src/pages/group-chat.hbs built
[ ] Wired into src/pages/index.hbs (and about.hbs)
[ ] pnpm check passes
[ ] OG screenshot captured (images/screenshots/group-chat.jpg, ≥10KB)
[ ] ogImage added to frontmatter
[ ] pnpm check + prettier, git commit
[ ] OG screenshot uploaded to Meta, META_IMAGE_HASH set
[ ] 3 ad variants written
[ ] 3 ads created ACTIVE at $10/day
[ ] All 9 ad objects confirmed ACTIVE via API
[ ] agents/handoff-group-chat-ads.md created
```
