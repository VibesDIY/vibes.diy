# Customize/Remix Copy Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn up the "you can customize this app for your specific situation" message on all audience and category landing pages, without using AI language or fabricated testimonials.

**Architecture:** Each page gets up to 3 targeted copy injections — a fork-naming sentence near Clone/Remix buttons, a context line near prompt64 links, and optionally a "make it yours" callout block before the footer/CTA. No CSS or layout changes. Each agent handles one group of pages independently.

**Tech Stack:** Handlebars `.hbs` templates, static HTML build via `pnpm check`.

---

## The Shared Task Prompt

Every subagent task below uses the same copy instruction. Read this section first — it is the job description.

### What you are adding

**1. Fork-naming sentence** — For every app card that has Clone/Remix/Start-Fresh buttons, add ONE sentence immediately after (or near) the button cluster. Name a concrete hypothetical variation specific to that app's actual function. Read the app's `desc` field or tagline and name a real variant someone might actually want.

Good: *"Works for refrigeration commissioning or boiler startup too — clone it and rename the fields."*
Good: *"Want the quiz seeded with your group's inside jokes instead of generic pop culture? Clone it and rewrite the questions."*

**2. Prompt link context** — Where a `// start fresh from this prompt` link or prompt64 link exists with no surrounding explanation, add one sentence nearby: *"The prompt that made this app. Describe your version instead."* If the surrounding text already explains this, leave it alone.

**3. "Make it yours" callout** — On pages with multiple app cards, add a short block (1–2 sentences, no heading needed) between the last app and the footer or CTA section. Name the page's topic and invite the specific variation. Example: *"These were built for rec-league coordinators. Clone any one and describe your format — five-on-five, co-ed, playoffs by seed, however your league actually runs."*

**4. CTA copy** — If the page's final CTA body text is generic, add one clause that signals the thing they build will be specific to their situation. Don't rewrite headings. Only update body copy if it's genuinely generic.

### Critical rules — do not break these

- **NO fabricated testimonials or stories.** Never write "a [person] in [city] cloned this" or "someone made this for their [group]." Those are fictions. Hypothetical form only: "Want this for X? Clone it and say so." The distinction matters: hypotheticals name a *possibility*, testimonials imply a *history that didn't happen*. Fabricated social proof is worse than no social proof.
- **NO AI language.** Don't say "AI generates your version," "the AI will customize it," "just prompt it to change." The creative agency belongs to the user. Correct framing: *you* described your version, *it* built that. If the page already avoids AI language, preserve that pattern.
- **Don't touch CSS, layout, or structure.** Only copy text inside HTML elements or frontmatter strings. Never change class names, selectors, or markup.
- **Don't run prettier on `.hbs` files.** The CLAUDE.md explicitly forbids it — Handlebars conditionals in HTML attributes break the parser. Run `npx prettier --write` only on `.js` or `.json` files if you touch them (you probably won't).
- **Read before you write.** Assess what's already there honestly. Some pages (party-games, teachers, valentines) already have strong customization copy. If a page is already good, make minimal additions or skip.
- **Preserve voice.** Terminal-aesthetic pages (teachers.hbs, college.hbs) sound like a terminal. Neobrutalist pages (coaches.hbs, hotwheels.hbs) are punchy and short. Editorial pages (contractors.hbs) are precise and practical. Don't homogenize.
- **Commit each file individually** after `pnpm check` passes. Don't batch-commit all pages in a single commit.

### Pages to skip entirely

These pages are out of scope — do not modify them:
- `index.hbs` — homepage, too broad
- `about.hbs` — already has strong "clone it and make it yours" copy
- `builders.hbs` — different audience (builders), different framing is intentional
- `connect-backend-data.hbs`, `psu-hackathon.hbs`, `vibes-connect.hbs` — infrastructure/event pages
- `how-to.hbs` — instructional, different purpose
- `featured-apps/index.hbs` — gallery index
- `expressions/*.hbs` — pure gallery, webring layout, no CTA chrome

---

## Task 1 — Standard audience pages (no embedded apps)

**Assigned files:**
- `src/pages/coaches.hbs`
- `src/pages/homeschoolers.hbs`
- `src/pages/organizers.hbs`
- `src/pages/rec-league.hbs`
- `src/pages/summer-camp.hbs`
- `src/pages/volunteer-coordinators.hbs`
- `src/pages/pta-pto.hbs`
- `src/pages/reshippers.hbs`

These pages describe a use case and CTA but don't embed deployed apps. Their "How It Works" step 1 descriptions use generic example prompts. The CTA sections are the main target.

- [ ] **Step 1: Read `coaches.hbs` in full**

Read `src/pages/coaches.hbs`. Locate: (a) the "How It Works" step 1 description — currently "Type something like 'a team hub with schedule, roster, a game-day scoreboard, and a place to post announcements'" — and (b) the CTA section body text.

- [ ] **Step 2: Update coaches step 1 example**

Replace the generic step 1 example prompt with one that is specific and weird enough to prove the point. Keep the same HTML structure. The new example should name a real sport-specific quirk — e.g., "a scorecard for a seven-on-seven flag football league where sacks count as negative yards and the standings reset at week four." Show that the description can be as specific as the reader's actual situation, not just a generic template.

- [ ] **Step 3: Update coaches step 2 copy**

Step 2 is "Make it match your league." The body text currently says: "Customize positions, divisions or levels, game formats, and the stats you track." Update to name one concrete weird example — e.g., "Your league has a weird tiebreaker rule nobody else uses. Describe it. The app handles it."

- [ ] **Step 4: Update coaches CTA body text**

Current: "Scoreboards, playbooks, schedules, rosters, and updates. If you can describe it, you can build it."

Update to add specificity: name that what gets built will be specific to *their* situation, not the generic template. Keep the same punchy two-sentence rhythm. Example direction: "Scoreboards for your specific game. Schedules for your actual season. If you can describe your league, you can build the hub it needs."

- [ ] **Step 5: Run build and commit coaches**

```bash
cd /Users/jchris/code/landing-pages && pnpm check
```

Expected: `_site/coaches.html` written, no errors. Then:

```bash
git add src/pages/coaches.hbs
git commit -m "copy: sharpen customize angle on coaches — specific example in How It Works, CTA"
```

- [ ] **Step 6: Repeat pattern for each remaining file in this task**

For each of: `homeschoolers.hbs`, `organizers.hbs`, `rec-league.hbs`, `summer-camp.hbs`, `volunteer-coordinators.hbs`, `pta-pto.hbs`, `reshippers.hbs`:

1. Read the file. Find: hero/intro copy, "How It Works" or equivalent section, CTA.
2. Add specificity to the example in the "describe what you want" step if one exists.
3. Update CTA body to name the specific/weird variation the reader might actually have.
4. If the page already has strong customization copy, make minimal additions only.
5. `pnpm check` after each file.
6. Commit each file individually with message `copy: sharpen customize angle on <pagename>`.

---

## Task 2 — App-grid pages, community/lifestyle

**Assigned files:**
- `src/pages/accountability.hbs`
- `src/pages/bike-summer.hbs`
- `src/pages/block-party.hbs`
- `src/pages/church-summer.hbs`
- `src/pages/college.hbs`
- `src/pages/dating.hbs`
- `src/pages/relationships.hbs`
- `src/pages/science-kits.hbs`
- `src/pages/sharing.hbs`

These pages embed deployed apps with Clone/Remix/Start-Fresh buttons. Primary target: fork-naming sentence near each app's buttons, plus a "make it yours" callout before the footer.

- [ ] **Step 1: Read `college.hbs` in full**

Note: `college.hbs` uses a terminal/slab-concrete aesthetic. Clone/Remix/Start-From-Prompt buttons appear under each app. The epilogue section (if any) is the place for the "make it yours" callout. Voice: dry, lowercase, specific.

- [ ] **Step 2: Add fork-naming sentence to each college app card**

For each of the five apps, add ONE sentence after the Clone/Remix button cluster. Base it on the app's `desc` field. Example direction for the laundry app: "Your floor has eight washers and a different drama. Clone it and update the machine count." Voice must stay consistent with the terminal aesthetic.

- [ ] **Step 3: Add "make it yours" callout to college.hbs**

Add 1–2 sentences between the last app card and the footer. Example direction: "These five were built for one dorm's exact problems. Yours probably has different ones. Clone whichever is closest and describe what's different."

- [ ] **Step 4: Run build and commit college**

```bash
cd /Users/jchris/code/landing-pages && pnpm check && git add src/pages/college.hbs && git commit -m "copy: add fork-naming and make-it-yours callout to college"
```

- [ ] **Step 5: Repeat pattern for each remaining file in this task**

For each of: `accountability.hbs`, `bike-summer.hbs`, `block-party.hbs`, `church-summer.hbs`, `dating.hbs`, `relationships.hbs`, `science-kits.hbs`, `sharing.hbs`:

1. Read the file. Find all app cards with Clone/Remix/prompt64 buttons.
2. For each app card, add ONE fork-naming sentence. Base it on the app's actual function.
3. Add a "make it yours" callout (1–2 sentences) between the app grid and footer/CTA.
4. If prompt64 links exist without surrounding context, add: "The prompt that made this app. Describe your version instead."
5. `pnpm check` after each file.
6. Commit each individually: `copy: add fork-naming and customize callout to <pagename>`.

---

## Task 3 — App-grid pages, games/sports

**Assigned files:**
- `src/pages/fantasy-league.hbs`
- `src/pages/golf-league.hbs`
- `src/pages/trivia-night.hbs`
- `src/pages/trivia.hbs`
- `src/pages/world-cup-pool.hbs`
- `src/pages/would-you-rather.hbs`
- `src/pages/hotwheels.hbs`
- `src/pages/puppies.hbs`
- `src/pages/valentines.hbs`

Note: `valentines.hbs` and `would-you-rather.hbs` already have some customization copy. Read carefully before adding — make minimal additions if the copy is already strong.

- [ ] **Step 1: Read all nine files and assess existing customization copy**

For each file, note: (a) does it already have fork-naming or "make it yours" copy? (b) are Clone/Remix/prompt64 buttons present? (c) what is the voice/aesthetic?

- [ ] **Step 2: Apply the three-pattern treatment to each file**

For each file, in order:
1. Fork-naming sentence per app card (where buttons exist).
2. "Make it yours" callout before footer/CTA.
3. Prompt link context if naked prompt64 links exist.
4. CTA body update if generic.

For `trivia-night.hbs`: the "How It Works" section is prose (not numbered steps). It currently explains the mechanics. Add a sentence at the end of that prose block naming what someone would change: "Your crowd has a thing — add a themed round, change the scoring, add a lightning tie-breaker. Clone it and describe what's different."

- [ ] **Step 3: Build and commit each file**

```bash
pnpm check
```

Then commit each file individually: `copy: add fork-naming and customize callout to <pagename>`.

---

## Task 4 — App-grid pages, work/creative

**Assigned files:**
- `src/pages/contractors.hbs`
- `src/pages/creators.hbs`
- `src/pages/engineers.hbs`
- `src/pages/fashion-photographers.hbs`
- `src/pages/food-trucks.hbs`
- `src/pages/music-studio.hbs`
- `src/pages/philosophy.hbs`
- `src/pages/youtubers.hbs`
- `src/pages/electric-psych-rock.hbs`

Note: `contractors.hbs` has a spotlight app (first app, larger treatment) plus a grid. The spotlight already has Clone/Remix/Start-fresh buttons. Fork-naming is especially important here because the trades audience has highly specific workflows that the generic app won't cover.

`music-studio.hbs` is the longest page in the repo (~1058 lines). Read carefully — it may already have "build your own version" copy. Add fork-naming per instrument/tool where it doesn't already exist.

- [ ] **Step 1: Read `contractors.hbs` in full**

Locate: spotlight app section (first app), app grid section, CTA section. Note that the spotlight app has a description ending with "No paper, no re-keying."

- [ ] **Step 2: Add fork-naming to contractors spotlight**

After the spotlight's Clone/Remix/Start-fresh buttons, add one sentence naming a trades-specific variation. Read the HVAC app's `desc` and pick a neighboring trade that would use the same checklist structure. Example direction: "Works for refrigeration commissioning, boiler startup, or any trade that signs off on equipment — clone it and rename the fields."

- [ ] **Step 3: Add fork-naming to contractors app grid**

For each of the remaining four app cards (electrical punch log, plumbing service form, permit tracker, materials builder), add one fork-naming sentence. Each sentence must be specific to that app's function, not generic.

- [ ] **Step 4: Add "make it yours" callout to contractors**

Between the app grid and the footer, add 1–2 sentences. Example: "Every trade runs differently. Clone whichever is closest and describe your version — your form fields, your workflow, your customer handoff."

- [ ] **Step 5: Commit contractors, then repeat for remaining files**

```bash
pnpm check && git add src/pages/contractors.hbs && git commit -m "copy: add fork-naming and customize callout to contractors"
```

Then apply the same pattern to: `creators.hbs`, `engineers.hbs`, `fashion-photographers.hbs`, `food-trucks.hbs`, `music-studio.hbs`, `philosophy.hbs`, `youtubers.hbs`, `electric-psych-rock.hbs`. Commit each individually.

---

## Task 5 — Misc special pages

**Assigned files:**
- `src/pages/babylon-3d.hbs`
- `src/pages/generate.hbs`
- `src/pages/shared-rituals.hbs`
- `src/pages/skits-never-happened.hbs`
- `src/pages/creator-documentation.hbs`
- `src/pages/wedding.hbs`

These pages are varied in purpose. Read each one carefully before making changes. `shared-rituals.hbs` already has some "visit one, clone it for your crew" copy — make minimal additions. `wedding.hbs` has "fork it, make it yours" in the footer — check if the app-card level has fork-naming.

- [ ] **Step 1: Read all six files, identify gaps**

Assess: which pages have app cards with buttons that lack fork-naming? Which CTAs are generic? Which already have strong customization copy?

- [ ] **Step 2: Apply targeted additions**

For each file with gaps, apply the relevant patterns from the shared task prompt (fork-naming, prompt context, callout, CTA). Skip anything already covered.

- [ ] **Step 3: Build and commit each file**

```bash
pnpm check
```

Commit each individually: `copy: add customize angle to <pagename>`.

---

## Task 6 — Featured-apps category pages, batch 1

**Assigned files:**
- `src/pages/featured-apps/classroom-tools.hbs`
- `src/pages/featured-apps/creative-studios.hbs`
- `src/pages/featured-apps/fitness-and-sports.hbs`
- `src/pages/featured-apps/garden-and-plants.hbs`
- `src/pages/featured-apps/hero-at-work.hbs`
- `src/pages/featured-apps/house-rules.hbs`
- `src/pages/featured-apps/household-logistics.hbs`
- `src/pages/featured-apps/image-generation.hbs`

These pages use frontmatter-driven templates with fields like `whyDesc`, `heroDesc`, `heroStatLabel`, and `appsSections[].intro`. The copy lives in the frontmatter JSON block, not in raw HTML.

**Structure of frontmatter fields:**
- `whyDesc` — the "why these exist" paragraph shown in the editable/Why section
- `heroStatLabel` — the small label under the hero stat number (e.g. "one party kit. Each one a single-file React app you can clone and re-skin for your crew.")
- `appsSections[].intro` — prose paragraph introducing each cluster of apps

**Where to add customization copy:**
1. In `appsSections[].intro`: for each cluster, add one sentence naming a hypothetical variation. Keep the same voice and length as existing intros.
2. In `whyDesc`: if generic, add 1–2 sentences naming the specific weird situation the reader might have.
3. `heroStatLabel`: can name the clone/remix affordance if it doesn't already.

- [ ] **Step 1: Read `classroom-tools.hbs` frontmatter**

Parse the JSON frontmatter block. Find `whyDesc` and each `appsSections[].intro`. Assess: does the copy already name specific variations? Is "clone it and change the questions" type language present?

- [ ] **Step 2: Update classroom-tools.hbs**

In each `appsSections[].intro` that is generic, add one sentence naming a hypothetical variation. Example: if the intro describes a vocab quiz, add: "Want it seeded with your unit's vocabulary instead of generic words? Clone it and replace the word list." Then update `whyDesc` if generic.

- [ ] **Step 3: Build and commit classroom-tools**

```bash
pnpm check && git add src/pages/featured-apps/classroom-tools.hbs && git commit -m "copy: add fork-naming to classroom-tools appsSections intros"
```

- [ ] **Step 4: Repeat for each remaining file in this task**

Apply the same pattern to: `creative-studios.hbs`, `fitness-and-sports.hbs`, `garden-and-plants.hbs`, `hero-at-work.hbs`, `house-rules.hbs`, `household-logistics.hbs`, `image-generation.hbs`. Commit each individually.

---

## Task 7 — Featured-apps category pages, batch 2

**Assigned files:**
- `src/pages/featured-apps/kitchen-and-cooking.hbs`
- `src/pages/featured-apps/linkedin-influencers.hbs`
- `src/pages/featured-apps/mood-and-journals.hbs`
- `src/pages/featured-apps/neighborhood-swaps.hbs`
- `src/pages/featured-apps/outdoor-logs.hbs`
- `src/pages/featured-apps/party-games.hbs`
- `src/pages/featured-apps/pets.hbs`
- `src/pages/featured-apps/photo-identifiers.hbs`
- `src/pages/featured-apps/rituals-and-goals.hbs`
- `src/pages/featured-apps/run-the-place.hbs`

Note: `party-games.hbs` already has strong customization copy in `whyDesc` ("Cards Against Humanity stopped being funny when your group chat had its own jokes..."). Read it first — if it's already hitting the right notes, make minimal additions only.

Same structure as Task 6: changes live in frontmatter JSON fields (`whyDesc`, `appsSections[].intro`, `heroStatLabel`).

- [ ] **Step 1: Read all ten files and assess existing copy quality**

For each, note: does `whyDesc` name specific variations? Do `appsSections[].intro` fields have fork-naming language? Is `heroStatLabel` already strong?

- [ ] **Step 2: Apply targeted additions to each file**

For files where customization copy is weak or absent, add fork-naming sentences to `appsSections[].intro` and update `whyDesc` if generic. For files already strong (`party-games.hbs`), make zero or minimal changes.

- [ ] **Step 3: Build and commit each file**

```bash
pnpm check
```

Commit each individually: `copy: add fork-naming to <pagename> appsSections`.

---

## Self-Review Checklist

After all tasks are complete, the following must be true for every modified file:

- [ ] No fabricated testimonials ("a [person] in [city] cloned this" — none of this anywhere)
- [ ] No AI language ("AI generates", "the AI will", "prompt engineering")
- [ ] Every app card with Clone/Remix buttons has at least one fork-naming sentence near it
- [ ] Pages with multiple apps have a "make it yours" callout before footer/CTA (or it was already there)
- [ ] `pnpm check` passes on the full build
- [ ] Each modified file committed individually
