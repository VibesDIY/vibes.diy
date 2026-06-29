# Handoff — Academic Syllabus Harvest

**Branch:** `worktree-harvest-runbook-prompt-spec`
**PR:** [#46](https://github.com/VibesDIY/landing-pages/pull/46)
**Issue:** [#44](https://github.com/VibesDIY/landing-pages/issues/44)
**Date:** 2026-05-19

---

## What's done

### Phase 1 — Harvest ✓ complete

48 syllabi across 8 geographically diverse US institutions, all committed as one JSON file per institution in `research/harvest/`:

| File | Institution | Region | Items |
|---|---|---|---|
| `mit-ocw.json` | MIT OpenCourseWare | Northeast | 6 |
| `stanford-see.json` | Stanford University | West Coast | 6 |
| `berkeley.json` | UC Berkeley | West Coast | 6 |
| `cmu.json` | Carnegie Mellon | Mid-Atlantic | 6 |
| `utexas.json` | UT Austin | South/Central | 6 |
| `uw-madison.json` | UW Madison | Midwest | 6 |
| `unc-chapel-hill.json` | UNC Chapel Hill | Southeast | 6 |
| `uw-seattle.json` | University of Washington | Pacific Northwest | 6 |

**Department coverage:** Data Science/Stats (11), Public Health (10), Urban Planning (9), Behavioral Economics (8), Environmental Studies (6), Education Research (4).

**Cross-source vocabulary signals** — topics appearing 3+ times across institutions, which are the cluster candidates:
- `instrumental variables` (6×)
- `prospect theory` (4×)
- `potential outcomes framework`, `difference-in-differences`, `spatial analysis`, `loss aversion`, `matching estimators` (3× each)

### Survey of available collections ✓ complete

`research/available-collections.md` documents everything found but not yet harvested — humanities departments at the same 8 institutions, cross-institutional repositories (H-Net, Humanities Commons, OSP), and a full media arts survey (NYU ITP, UCLA DMA, SFPC, Golan Levin/CMU). Priority matrix at the bottom of that file.

### Runbook ✓ complete

`agents/resource-harvest-to-pages.md` is the domain-agnostic pipeline for any future harvest run (bluegrass bands, recipes, conference programs, etc.). Phase 3 prompt spec calls for ~2000-token app prompts with detailed domain context — see the causal inference worked example in the runbook.

---

## What's next

### Phase 2 — Cluster

Read all `research/harvest/*.json`. Group topics into 6–10 concept clusters that appear across 2+ institutions. Write one JSON per cluster to `research/clusters/`. Each cluster becomes one landing page slug.

Starting suggestions based on cross-source vocabulary overlap:
- **causal-inference** — instrumental variables, potential outcomes, DiD, RD design (strongest signal, 6 institutions)
- **spatial-analysis** — GIS, spatial statistics, geodatabases, cartographic representation (4 institutions)
- **behavioral-economics** — prospect theory, loss aversion, present bias, nudges (5 institutions)
- **epidemiology-methods** — study design, confounding, cohort studies, survival analysis (4 institutions)
- **machine-learning-methods** — cross-validation, regularization, clustering, dimensionality reduction (4 institutions)
- **climate-policy** — climate risk, emissions accounting, adaptation strategies (3 institutions)

Cluster schema: `research/clusters/README.md`

### Phase 3 — App Prompts

For each cluster file, add 5 app prompts to the `app_prompts` array. Rules from the runbook:
- ~2000 tokens each
- Domain vocabulary from `vocabulary` list — exact terms
- Realistic scenario with who/what/prior knowledge
- Use-case ladder: playful → community coordination → operational → professional/mission-critical
- No code advice, no styling dictation, no architecture opinions

The causal inference worked example in `agents/resource-harvest-to-pages.md` is the model to follow.

### Phases 4–5 — Generate and Page

Follow existing runbooks:
- `agents/batch-landing-pages.md` — batch generate via vibes-diy CLI
- `agents/new-audience-page.md` — build .hbs and wire to index

---

## Key decisions made (don't re-litigate)

- **One JSON per institution** (not one per department) — keeps the cluster phase's input manageable
- **6 items per institution** — enough vocabulary diversity without over-representing any one school
- **`research/` for this run; `research-<domain>/` for future domains** — never mix domains in the same directory
- **~2000-token app prompts** (not sub-50-word) — deliberate departure from raw vibes-diy CLI usage; these are design briefs for the generation model, not CLI prompts
- **HB2504 as priority source for a humanities run** — UT Austin's public-record mandate gives entire humanities curriculum as downloadable PDFs; worth a dedicated pass
- **ITP/NYU as the entry point for a media arts run** — 3 parallel channels (listings site, ITPNYU GitHub, IDMNYU GitHub), 315 combined repos, openly accessible

---

## Files to read before starting Phase 2

1. `agents/resource-harvest-to-pages.md` — full pipeline spec and cluster schema
2. `research/README.md` — institution table and department targets
3. `research/harvest/README.md` — harvest JSON schema
4. `research/clusters/README.md` — cluster JSON schema
5. Any 2–3 harvest files to internalize the vocabulary
