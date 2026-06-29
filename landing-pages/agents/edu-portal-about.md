# About the Edu Portal

## What this is

The Vibes DIY Edu Portal is a collection of interactive apps built from real academic syllabi — harvested, clustered by concept, and turned into tools that let you explore the ideas taught in university courses.

## Methodology

### Phase 1 — Harvest

We fetch publicly available syllabi from open university repositories and academic networks. Each syllabus is parsed for the specific vocabulary terms that instructors use: the concepts, methods, frameworks, and debates that define each field.

**Academic harvest sources (STEM/social science):**

- MIT OpenCourseWare (Data Science, Public Health, Urban Planning, Behavioral Economics, Environmental Studies, Education Research)
- Stanford, UC Berkeley, Carnegie Mellon, UT Austin, UW Madison, UNC Chapel Hill, UW Seattle

**Humanities harvest sources:**

- MIT OpenCourseWare — Literature, History, Linguistics & Philosophy
- H-Net H-Diplo — Diplomatic and International History
- H-Net H-Urban + H-LatAm — Urban History, Latin American History
- UW–Madison History Department Syllabi Library
- UT Austin HB2504 Archive — English, History, Philosophy, Film Studies

All harvest data lives in `research/` (STEM/social science) and `research-humanities/` (humanities) in this repository. The raw JSON files include source URLs, fetch methods, and verbatim excerpts from the syllabi.

### Phase 2 — Cluster

Topics that appear across multiple institutions and courses are grouped into concept clusters. Each cluster represents a real area of academic inquiry with organic search intent — the vocabulary people actually type into Google when looking for resources in that field.

Each cluster JSON file in `research/clusters/` and `research-humanities/clusters/` lists:

- The canonical vocabulary terms for that cluster
- Which courses and institutions contributed those terms
- The app prompts written for that cluster

### Phase 3 — Apps

For each cluster, we generate 5 interactive apps using the Vibes DIY platform. The apps range from playful explainers (accessible to curious newcomers) to professional-grade workflow tools (for practitioners). Each app is built around the authentic vocabulary of the field.

### Pages as corpus access

Each landing page for a cluster is also an entry point into the underlying corpus:

- **Vocabulary section** — the full topic list for that cluster, showing which terms appear across institutions
- **Source syllabi** — links back to the original courses that contributed to the cluster
- **Apps** — tools built around those exact terms, so you can explore the concepts interactively

The goal: if you search for "causal inference" or "postcolonial theory" and land on one of these pages, you get both tools to play with the ideas AND a clear view of where those ideas come from in real university curricula.

## Data transparency

All harvest data is open and version-controlled:

- `research/harvest/*.json` — STEM/social science syllabi
- `research-humanities/harvest/*.json` — Humanities syllabi
- `research/clusters/*.json` — STEM clusters with vocabulary and app prompts
- `research-humanities/clusters/*.json` — Humanities clusters

Each file includes the source URL, fetch method, and a verbatim excerpt justifying each topic extraction. Where PDFs were inaccessible and topics were derived from course descriptions, this is noted in `fetch_method: "substituted"` with a `substitution_reason`.

## Why syllabi?

Syllabi are the canonical vocabulary document of academic fields. When a faculty member writes a syllabus, they're doing two things simultaneously:

- Defining the intellectual territory for students
- Signaling to peers what the course covers

That dual function makes syllabi uniquely valuable: they use the exact terms that practitioners search for, while being publicly available and recently updated. They're the closest thing to a "term-of-art dictionary" that most academic fields produce.
