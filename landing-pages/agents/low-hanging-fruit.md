# Low-Hanging Fruit — good.vibes.diy

Identified 2026-05-20. Working tree is clean at this point; all changes committed.

---

## 1. Add "About" to edu navigation (trivial — 3 edits)

`edu/about.html` exists and is polished but isn't linked from any navigation.

**Edit 1 — `src/pages/edu/index.hbs` footer:**

Current:
```html
<a href="{{assetPrefix}}index.html">← good.vibes.diy</a>
<span class="sep">·</span>
<a href="https://links.vibes.diy/homepage">Vibes DIY</a>
<span class="sep">·</span>
<a href="https://links.vibes.diy/discord">Discord</a>
```

Add before the footer closing tag:
```html
<span class="sep">·</span>
<a href="about.html">About the portal</a>
```

**Edit 2 — All 22 cluster page footers** (`src/pages/edu/*.hbs`, except index/syllabi/about):

Current pattern:
```html
<a href="index.html">← Edu Index</a>
<span class="sep">·</span>
<a href="syllabi.html">Syllabus Corpus</a>
<span class="sep">·</span>
<a href="https://links.vibes.diy/homepage">Vibes DIY</a>
```

Add after Syllabus Corpus:
```html
<span class="sep">·</span>
<a href="about.html">About</a>
```

Files to edit (all `.hbs` in `src/pages/edu/` except `index.hbs`, `syllabi.hbs`, `about.hbs`, `study/`):
- algorithmic-creative-writing, behavioral-economics, capitalism-labor-history, causal-inference,
  climate-change-policy, cold-war-history, critical-algorithms, epidemiology-study-design,
  ethics-philosophy, gender-colonialism, latin-american-history, literary-analysis,
  machine-learning-methods, music-sound-culture, policy-analysis-decision-modeling,
  research-methods-regression, revolutions-political-change, slavery-civil-rights,
  spatial-analysis-gis, urban-land-use-planning, urban-race-housing, us-foreign-policy

**Edit 3 — `src/pages/about.hbs` (site-level about):**

The prose already links to `edu/index.html` and `edu/syllabi.html`. Add a link to `edu/about.html` — e.g. change:

```html
Subject clusters in the <a href="edu/index.html">Edu section</a> are grounded in
<a href="edu/syllabi.html">real university syllabi</a>.
```

to something like:

```html
The <a href="edu/index.html">Edu section</a> has 22 subject clusters grounded in
<a href="edu/syllabi.html">real university syllabi</a> — <a href="edu/about.html">read about the approach</a>.
```

After all three edits: `pnpm check`, `node screenshot-pages.js` (only changed pages will re-run), commit.

---

## 2. Deploy the 9 STEM cluster apps (medium — highest leverage)

The 9 STEM cluster pages (`behavioral-economics`, `causal-inference`, `climate-change-policy`,
`epidemiology-study-design`, `machine-learning-methods`, `policy-analysis-decision-modeling`,
`research-methods-regression`, `spatial-analysis-gis`, `urban-land-use-planning`) have 5 tools
each — all currently shown as "build this app →" prompt links, with `live: false`.

Deploying them would add 45 live tools and flip 9 clusters from "here's a prompt" to actual
interactive apps. This is the biggest single content gap in the edu portal.

### Source data

Each cluster's prompts are in `research/clusters/<slug>.json` under `app_prompts[]`. Each entry
is a prose description — use it verbatim as the CLI prompt.

Each cluster's `.hbs` already has the `apps[]` array with `slug`, `title`, `tagline`, `desc`
fields. To go live, set `live: true` and `author: "edu"` on each app entry, and make sure the
`slug` matches what was deployed via CLI.

### Deployment pattern

See `agents/batch-landing-pages.md` and the general CLI guide in `CLAUDE.md` for full details.
Short version:

```bash
# For each cluster, create vibes/<cluster>/_run.sh:
npx vibes-diy@latest generate \
  --user-slug=edu \
  --app-slug=<seo-slug> \
  "<prompt from app_prompts[]>"

# Verify each deploy is real (not a stub):
curl -sL https://<slug>--edu.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
# Good: "fsId":"z<CID>" ... mountVibe([V1], …)
# Bad:  "fsId":"pending"
```

After all 5 apps per cluster are live:
1. Update the cluster's `.hbs` frontmatter: set `"live": true` and `"author": "edu"` on each app.
2. `pnpm check` to rebuild.
3. Screenshots will auto-update on next `node screenshot-pages.js` run.

### Clusters and their app slugs (as defined in the .hbs files)

| Cluster | App slugs |
|---------|-----------|
| behavioral-economics | behavior-journal, be-book-club, nudge-pipeline, field-experiment-design, retirement-policy-design |
| causal-inference | causation-vs-correlation, methods-reading-group, causal-design-workshop, diff-in-diff-memo, evidence-review-protocol |
| climate-change-policy | household-carbon-explorer, climate-resilience-map, climate-action-tracker, energy-policy-assessment, climate-assessment-synthesis |
| epidemiology-study-design | study-design-drills, outbreak-investigation, disease-surveillance-workflow, cohort-analysis-plan, evidence-synthesis-epi |
| machine-learning-methods | ml-toolkit-explorer, collaborative-modeling, model-portfolio-ops, clinical-model-development, ml-regulatory-review |
| policy-analysis-decision-modeling | cba-practice, policy-capstone-workspace, regulatory-analysis-workflow, major-rule-analysis, rulemaking-review |
| research-methods-regression | regression-literacy, methods-peer-group, research-lab-workflow, longitudinal-study-plan, evidence-clearinghouse |
| spatial-analysis-gis | neighborhood-gis-explorer, community-mapping-workspace, planning-gis-workflow, ev-suitability-analysis, disaster-gis-ops |
| urban-land-use-planning | zoning-explorer, comp-plan-coordination, development-case-workflow, regional-transport-plan, housing-element-review |

---

## Status snapshot (as of 2026-05-20)

| Section | Status |
|---------|--------|
| Edu humanities (13 clusters) | All live — 65 tools deployed |
| Edu STEM/social science (9 clusters) | Pages live, apps not deployed |
| Edu study tools | Live (flashcards, quizzes, etc.) |
| Edu about page | Exists, not in navigation |
| Philosophy page | Live — 7 apps deployed under `edu` slug, homepage card wired |
| Expressions (8 clusters) | All live |
| Featured apps (18 categories) | All live |
| Mind games (8 types × 4 variants) | All live |
