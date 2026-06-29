# Philosophy Landing Page Design

**Date:** 2026-05-20  
**Slug:** `philosophy`  
**URL:** `https://good.vibes.diy/philosophy/`  
**Template:** `src/pages/philosophy.hbs`  
**Layout:** `standard`  
**Audience:** Philosophy students and curious non-specialists  
**User slug for app generation:** `edu`

---

## Goal

A neobrutalist audience page that introduces seven interactive philosophy apps derived from the Stanford Encyclopedia of Philosophy (SEP). The unifying theme is the knowing-how/knowing-that divide and what it reveals about the epistemic boundary between human and AI cognition. Each app is a thought-experiment tool, not a lecture.

---

## Apps

Seven new apps, generated via `npx vibes-diy@latest generate --user-slug=edu`, each prompted from the relevant SEP article(s):

| App slug | Title | SEP source(s) | Core interaction |
|---|---|---|---|
| `knowing-how-vs-knowing-that` | Knowing How vs. Knowing That | Knowledge How; Gilbert Ryle | User tries to reduce a skill to a list of propositions; Ryle's regress argument triggers — the list always needs another rule to apply it |
| `embodied-cognition-explorer` | Embodied Cognition Explorer | Embodied Cognition | Thought experiments where you can't separate cognition from the body; challenges computationalist assumptions |
| `phenomenology-first-person` | Phenomenology: First-Person | Phenomenology | Guided phenomenological analysis — Husserl/Heidegger/Merleau-Ponty; the structure of experience AI doesn't inhabit |
| `situated-knowledges` | Situated Knowledges | Feminist Epistemology and Philosophy of Science; Feminist Social Epistemology | Haraway's claim: knower position is epistemically constitutive, not bias to subtract; collective vs. individualist knowing |
| `virtue-epistemology` | Virtue Epistemology | Virtue Epistemology | Character-based belief evaluation; intellectual virtues as the ground of knowledge; rigor relocates from justification to formation |
| `ai-consciousness-boundary` | The AI Consciousness Boundary | Artificial Intelligence (SEP) | The hard problem of consciousness; why language production isn't proof of interiority; what AI hasn't touched |
| `extended-mind` | The Extended Mind | Externalism About the Mind | Clark & Chalmers: if your notebook is part of your mind, what happens when AI joins your cognitive apparatus? The question cuts both ways |

Prompts for each app should be detailed (500–1000 words) drawing directly from the SEP article text — positions, arguments, thought experiments, key figures. Do not dictate styling.

App deploy verification: after generation, confirm each subdomain has a real `fsId` (not `"pending"`) via:
```sh
curl -sL https://<slug>--edu.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

---

## Design

### Accent color
`--indigo: #3B2F8C`

Applied to:
- `.prop-card` border and box-shadow
- `.case-tag` background
- `.btn-primary` background
- Section accent `<span>` in the hero headline

### Design tokens (added to `:root`)
```css
--indigo: #3B2F8C;
```
All other tokens (`--black`, `--ivory`, `--grid-gray`, `--os-gray`) inherit from the standard site system.

### Typography & background
- Font: `Alte Haas Grotesk` (standard)
- Background: `--grid-gray` with CSS grid pattern (standard)

### Card system
Standard neobrutalist `.card` base:
```css
background: var(--ivory);
border-radius: 20px;
border: 3px solid var(--black);
padding: 2.5rem;
box-shadow: 6px 6px 0 var(--black);
```
Prop card variant overrides border and shadow to `var(--indigo)`.

---

## Page structure

Standard audience page section order:

1. **Sticky header** — logo linking to `https://links.vibes.diy/homepage`
2. **Hero** — badge "Explore Philosophy"; headline with indigo accent span (e.g. *"What does it mean to **know** something?"*); subtext about tacit/embodied/situated knowledge vs. propositional knowledge; two CTAs: "Start Exploring" (vibes.diy homepage) and "Join Discord"
3. **Value props** — 3-column card grid with indigo accent:
   - "Beyond Propositions" — Ryle's regress shows skills can't be reduced to rules
   - "The Knowing Body" — cognition is constituted by embodiment, not just housed in it
   - "Who Knows What" — the knower's position is epistemically constitutive, not a bias to subtract
4. **How it works** — numbered steps in a single card (Pick a topic → Engage the thought experiment → See how the positions apply → Build your own view)
5. **App grid** — 7 app cards with screenshot embeds, title, short description, Join/Clone/Remix links
6. **CTA section** — dark inverted card
7. **Footer** — standard partial

---

## Frontmatter

```json
{
  "layout": "standard",
  "title": "Philosophy Apps — Vibes DIY",
  "description": "Seven interactive philosophy apps exploring tacit knowledge, embodied cognition, phenomenology, situated knowledges, virtue epistemology, and the AI consciousness boundary.",
  "ogUrl": "https://good.vibes.diy/philosophy/",
  "ogImage": "https://good.vibes.diy/images/screenshots/philosophy.jpg",
  "source": "philosophy"
}
```

---

## Files changed

| File | Action |
|---|---|
| `src/pages/philosophy.hbs` | Create |
| `screenshot-pages.js` | Add `"philosophy"` to SLUGS array |
| `src/pages/index.hbs` | Add `.landing-card.philosophy` card |
| `vibes/philosophy/_run.sh` | Create batch generation script |
| `images/screenshots/philosophy.jpg` | Capture after build |

---

## Build & verification checklist

1. Generate all 7 apps via `vibes/philosophy/_run.sh`
2. Verify each has a real `fsId` (not `"pending"`)
3. Write `src/pages/philosophy.hbs` with app slugs wired in
4. `pnpm check` — confirm build succeeds
5. `open _site/philosophy.html` — visual check
6. Add `"philosophy"` to `screenshot-pages.js` SLUGS, run `node screenshot-pages.js`
7. Add `ogImage` to frontmatter
8. Add card to `src/pages/index.hbs`
9. `pnpm check` again, commit
