# Resource Harvest → Landing Pages

General-purpose runbook for turning a **common resource set** into cluster-targeted audience pages with deployed companion apps. The first instantiation is academic syllabi (see [issue #44](https://github.com/VibesDIY/landing-pages/issues/44)); the pattern carries to any domain.

## What makes a good resource set

The hinge point is a document type that simultaneously serves two populations:

- **Creators** — domain experts who produce the documents as a matter of professional practice
- **Audience** — people who consume the documents as reference material and already search for the vocabulary inside them

A resource set is suitable when:

- It is **publicly available** on the open web (or via archive/mirror)
- It is **recently published** — current editions use current vocabulary
- It contains **structured concept vocabulary**: topics, techniques, terms, tools — not just narrative prose
- The vocabulary has **organic search intent** — people type these exact phrases into Google
- The audience **already improvises with spreadsheets or docs** to manage problems described in the resource (see `notes/web-advertising-strategy.md` — strongest pages are where people already hack their own solutions)

| Resource type                | Creator             | Audience                     | Example domain     |
| ---------------------------- | ------------------- | ---------------------------- | ------------------ |
| University syllabi           | Faculty             | Students, lifelong learners  | Any academic field |
| Band set lists / tour riders | Musicians           | Fans, booking agents, venues | Music genres       |
| Conference programs          | Organizers          | Practitioners                | Any industry       |
| Recipe collections           | Chefs, food writers | Home cooks                   | Cuisine            |
| Game jam rubrics             | Jam organizers      | Indie developers             | Game dev           |
| Curriculum frameworks        | Education depts     | Teachers                     | K-12               |
| Denominational hymnals       | Religious bodies    | Congregations                | Faith communities  |

## Pipeline overview

```
Resource Set (published docs, URLs, archives)
        ↓
1. Harvest   — fetch docs, extract vocabulary → research/harvest/<source>.json
        ↓
2. Cluster   — group by concept              → research/clusters/<slug>.json
        ↓
3. Prompts   — write 5 app prompts per cluster (in cluster JSON)
        ↓
4. Generate  — batch deploy via vibes-diy CLI (vibes/<cluster>/_run.sh)
        ↓
5. Page      — src/pages/<slug>.hbs + wire to index
```

Phases 4 and 5 follow existing runbooks: [`agents/new-audience-page.md`](new-audience-page.md) and [`agents/batch-landing-pages.md`](batch-landing-pages.md).

---

## Phase 1 — Harvest

### Naming the research directory

Each domain gets its own top-level directory. Use `research/` for the first (academic syllabi) run. For subsequent domains use `research-<domain>/` (e.g. `research-bluegrass/`, `research-recipes/`). Never mix domains in the same directory — the cluster phase reads all files in `harvest/` and will conflate unrelated vocabularies.

### Planning the source list

Before fetching, decide:

- **How many sources?** 5–10 for a first run. Enough to get vocabulary overlap across institutions; not so many that the cluster phase buries you.
- **Source diversity criteria** — for academic syllabi, this is geographic (different US census regions, no two sources from the same metro). For other domains, define the equivalent: genre × region × venue size for bands; cuisine × country × era for recipes. Write the criteria down in `research/README.md` before starting.
- **Temporal range** — prefer the last 3 years. Record the year on every item.

### Output format

One JSON file per source in `research/harvest/`:

```json
{
  "source": "MIT OpenCourseWare",
  "location": "Cambridge, MA",
  "region": "Northeast",
  "fetched": "YYYY-MM-DD",
  "items": [
    {
      "title": "6.S897 Machine Learning for Healthcare",
      "department": "Data Science / Stats",
      "year": 2024,
      "url": "https://ocw.mit.edu/...",
      "fetch_method": "direct",
      "topics": [
        "causal inference",
        "observational studies",
        "survival analysis",
        "electronic health records"
      ],
      "source_text": "Week 3: Causal inference from observational data. We cover potential outcomes, propensity score matching, and instrumental variables."
    }
  ]
}
```

`source_text` is a verbatim 1–3 sentence excerpt from the document that justifies the extracted `topics`. This is the "show your work" field.

**`fetch_method` values:**

| Value         | Meaning                                                     |
| ------------- | ----------------------------------------------------------- |
| `direct`      | Fetched from canonical URL                                  |
| `jina`        | Fetched via `https://r.jina.ai/<url>` (markdown conversion) |
| `wayback`     | Fetched from `https://web.archive.org/web/<year>/<url>`     |
| `substituted` | A related resource was used instead                         |
| `issue-filed` | All options exhausted; GitHub issue opened                  |

When `substituted`, add:

```json
"substituted_for": "https://original-url-that-failed",
"substitution_reason": "2025 edition used; 2024 behind paywall"
```

When `issue-filed`, add:

```json
"issue_url": "https://github.com/VibesDIY/landing-pages/issues/NNN"
```

### Fetch fallback chain

For each resource URL, attempt in order:

1. **Direct fetch** — `WebFetch` on the canonical URL
2. **Jina Reader** — `https://r.jina.ai/<url>` returns clean markdown; bypasses JS-rendered pages
3. **Wayback Machine** — `https://web.archive.org/web/<year>/<url>` for pages behind login or moved
4. **Related resource** — assess a substitute with equivalent concept coverage: same document different year, sister institution, sibling course. Record lineage with `substituted_for` + `substitution_reason`.
5. **File a GitHub issue** — if all options fail, open an issue titled `Harvest: need help sourcing <type> from <source> — <context>` in the landing-pages repo. Record `"fetch_method": "issue-filed"` with the issue URL. **Do not silently skip.** Every planned slot must resolve to content or a tracked issue.

### Commit cadence

Commit each `research/harvest/<source>.json` as it completes. Don't wait for the full run. Partial progress is useful and committable.

---

## Phase 2 — Cluster

Read all `research/harvest/*.json`. Group `topics` by concept cluster — topics that appear across multiple sources and address the same underlying problem. Write one JSON per cluster to `research/clusters/`:

```json
{
  "slug": "causal-inference",
  "label": "Causal Inference",
  "department": "Data Science / Stats",
  "vocabulary": [
    "causal inference",
    "observational studies",
    "instrumental variables",
    "propensity score matching",
    "RCT design",
    "potential outcomes"
  ],
  "sources": [
    { "institution": "MIT", "title": "6.S897 ML for Healthcare", "url": "..." },
    { "institution": "UC Berkeley", "title": "Stat 156", "url": "..." }
  ],
  "app_prompts": []
}
```

`app_prompts` starts empty — filled in Phase 3.

Target: **6–10 clusters per harvest run.** Each cluster becomes one landing page slug.

A good cluster has:

- vocabulary that appears in 2+ sources (cross-source validation)
- a clear, searchable label (the slug people would type into Google)
- enough breadth to support 5 distinct app ideas

---

## Phase 3 — App Prompts

For each cluster, write 5 app prompts into `app_prompts`.

### Prompt length and content

Each prompt should be **close to 2000 tokens** — detailed and rich with technical domain context. This is the opposite of the sub-50-word vibes-diy CLI prompts used for raw generation. Here, the prompt is a **design brief** that gives the app model enough domain grounding to produce something substantive rather than a generic scaffold.

What to include:

- **Domain vocabulary** from `vocabulary` — use the exact terms the audience searches for
- **Realistic scenario**: who is using this, in what context, with what prior knowledge
- **Data types and typical inputs**: what does the user bring to the app (a dataset, a reading list, a measurement, a policy text)?
- **Key interactions**: what does the user do step by step?
- **What makes it useful vs. trivial**: what would a domain expert notice that a generic app would miss?

What to exclude:

- **No code advice** — don't specify data structures, algorithms, libraries, or implementation patterns. The model decides those.
- **No styling dictation** — don't specify colors, fonts, layout, or visual themes. The model picks its own skin.
- **No architecture opinions** — no "use a table", "show a chart", "use a modal." Describe the human task, not the UI.

### Ladder the use cases

The set of 5 prompts per cluster should span the use-case ladder from `notes/web-advertising-strategy.md`:

**playful/casual → community coordination → operational workflow → professional/mission-critical**

Not every rung needs its own prompt, but the set should imply the ladder exists. The playful prompt shows the concept is accessible; the professional prompt shows it scales.

### Example (causal-inference cluster)

```
"app_prompts": [
  "A curious undergraduate just finished a stats course and keeps second-guessing whether headlines are describing causal relationships or just correlations. They have real examples from news articles: a study claiming ice cream sales cause drownings, a paper saying coffee drinkers live longer, a policy claiming a job training program reduced unemployment. Build an interactive explainer where they paste in a claim, see a breakdown of what causal language was used, a diagram of the assumed causal graph, and a checklist of what would need to be true for the claim to hold causally — covering confounders, selection bias, and reverse causation. The app should help them build intuition for spotting the difference, not just give them a label.",

  "A graduate seminar in observational causal inference assigns a different paper each week — some use difference-in-differences, some use regression discontinuity, some use instrumental variables, some use matching. The TA wants a reading tracker where students log which paper they read, mark which identification strategy it uses, write one sentence describing the instrument or discontinuity or treatment, and flag whether they found the identifying assumptions convincing. The TA wants a dashboard showing coverage across identification strategies and a list of papers where most students found the assumptions weak — those become discussion priorities.",

  "A research team running an observational study on the effect of a city policy on air quality needs to design their analysis before looking at the outcome data. They have a treatment indicator (which neighborhoods got the policy), covariates (demographics, baseline pollution, proximity to industry), and a proposed outcome. Build a pre-registration assistant: the user describes their treatment, outcome, and available covariates; the app walks them through specifying their estimand, choosing a primary identification strategy, listing key assumptions and how they plan to test them, and writing a one-paragraph methods section in plain language. The result is a timestamped document they can share before unblinding.",

  "A policy analyst at a state health department is evaluating whether a Medicaid expansion affected emergency department utilization rates. They have county-level panel data: years 2018–2024, treatment timing varies by county, outcome is ED visits per 1000 residents, and they have covariates like poverty rate and insurance rate. They know about the Callaway-Sant'Anna critique of two-way fixed effects with staggered adoption. Build a workflow that walks them through specifying their DiD design, flags whether their setup has staggered timing, explains the relevant estimation concerns for their specific case, and outputs a structured methods memo they can hand to their supervisor.",

  "A clinical researcher is designing a study to evaluate whether a behavioral intervention reduces opioid relapse. Randomization is not possible — patients self-select into the program. They need to use propensity score matching to construct a comparison group from administrative records. They have 40 candidate covariates, a binary treatment indicator, and a 12-month follow-up outcome. Build a matching design tool: the user uploads their covariate list and specifies which they believe affect both selection and outcome; the app helps them reason through which covariates belong in the propensity model, what balance diagnostics to examine, how to handle common support violations, and what sensitivity analyses to pre-specify for unmeasured confounding. Output is a structured matching protocol document."
]
```

---

## Directory layout

```
research/
  README.md               ← pipeline entry point; source diversity criteria; links here
  harvest/
    README.md             ← schema reference; "see ../README.md for pipeline context"
    <source>.json
  clusters/
    README.md             ← schema reference; "see ../README.md for pipeline context"
    <slug>.json
```

The `research/` directory is domain-specific data, not reusable code. For a second harvest run (different domain), create a parallel directory: `research-bluegrass/`, `research-recipes/`, etc.

---

## Adapting to other domains

The schemas, fallback chain, cluster format, and prompt discipline are domain-agnostic. To adapt:

1. Identify a resource set meeting the criteria above.
2. Define source diversity criteria for that domain.
3. Create a new top-level `research-<domain>/` directory.
4. Run phases 1–5 as written.

The vocabulary extraction step (Phase 1 `topics`) is the most domain-sensitive part: for syllabi, extract course topics and techniques; for band set lists, extract song titles, sub-genres, and venue requirements; for recipe collections, extract techniques, ingredients, and occasion types.
