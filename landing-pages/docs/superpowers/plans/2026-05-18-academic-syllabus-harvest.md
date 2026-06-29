# Academic Syllabus Harvest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Tasks 2–9 are independent and can be dispatched in parallel** via superpowers:dispatching-parallel-agents.

**Goal:** Collect 40–56 syllabi from 8 US institutions across 6–8 departments, extract concept vocabulary, and write structured JSON to `research/harvest/` as Phase 1 of issue #44.

**Architecture:** Pure data collection — no build artifacts. Each institution produces one JSON file following the schema in `agents/resource-harvest-to-pages.md`. Fetch fallback chain: direct WebFetch → Jina Reader (`r.jina.ai`) → Wayback Machine → related substitute → file GitHub issue. READMEs scaffolded first (Task 1), then one harvest task per institution (Tasks 2–8), each committed on completion.

**Tech Stack:** WebFetch, WebSearch, `r.jina.ai` markdown proxy, `archive.org`, GitHub CLI (`gh issue create` for unresolvable failures), Python 3 JSON validation one-liners

---

### Task 1: Scaffold directory structure and READMEs

**Files:**

- Create: `research/README.md`
- Create: `research/harvest/README.md`
- Create: `research/clusters/README.md`

- [ ] **Step 1: Create `research/README.md`**

```markdown
# Research Pipeline

Data for issue #44. Academic syllabus harvest → concept clusters → landing pages.

Full runbook: [`agents/resource-harvest-to-pages.md`](../agents/resource-harvest-to-pages.md)

## Pipeline
```

Harvest → Cluster → App Prompts → Generate → Landing Page

```

## Source diversity criteria (US — this run)

8 institutions spanning all US census regions. No two from the same metro.

| File | Institution | Region |
|---|---|---|
| `harvest/mit-ocw.json` | MIT OpenCourseWare | Northeast |
| `harvest/stanford-see.json` | Stanford University | West Coast |
| `harvest/berkeley.json` | UC Berkeley | West Coast |
| `harvest/cmu.json` | Carnegie Mellon University | Mid-Atlantic |
| `harvest/utexas.json` | UT Austin | South/Central |
| `harvest/uw-madison.json` | UW Madison | Midwest |
| `harvest/unc-chapel-hill.json` | UNC Chapel Hill | Southeast |
| `harvest/uw-seattle.json` | University of Washington | Pacific Northwest |

## Status

| File | Status |
|---|---|
| `harvest/mit-ocw.json` | pending |
| `harvest/stanford-see.json` | pending |
| `harvest/berkeley.json` | pending |
| `harvest/cmu.json` | pending |
| `harvest/utexas.json` | pending |
| `harvest/uw-madison.json` | pending |
| `harvest/unc-chapel-hill.json` | pending |
| `harvest/uw-seattle.json` | pending |

## Target departments

- Data Science / Stats
- Environmental Studies
- Urban Planning
- Public Health
- Behavioral Economics
- Education Research

## Directories

- `harvest/` — one JSON per source institution; schema in `harvest/README.md`
- `clusters/` — concept cluster files written in Phase 2; schema in `clusters/README.md`
```

- [ ] **Step 2: Create `research/harvest/README.md`**

````markdown
# Harvest Data

One JSON file per source institution. See [`../README.md`](../README.md) for pipeline context and runbook link.

## Schema

```json
{
  "source": "Institution Name",
  "location": "City, State",
  "region": "US census region",
  "fetched": "YYYY-MM-DD",
  "items": [
    {
      "title": "Course or document title",
      "department": "Department cluster label",
      "year": 2024,
      "url": "https://...",
      "fetch_method": "direct | jina | wayback | substituted | issue-filed",
      "topics": ["term1", "term2", "term3"],
      "source_text": "Verbatim 1–3 sentence excerpt from the syllabus justifying the topics."
    }
  ]
}
```
````

### fetch_method values

| Value         | Meaning                                                                     |
| ------------- | --------------------------------------------------------------------------- |
| `direct`      | WebFetch on canonical URL                                                   |
| `jina`        | `https://r.jina.ai/<url>` markdown proxy                                    |
| `wayback`     | `https://web.archive.org/web/<year>/<url>`                                  |
| `substituted` | Related resource used; add `substituted_for` + `substitution_reason` fields |
| `issue-filed` | All options exhausted; add `issue_url` field pointing to the GitHub issue   |

````

- [ ] **Step 3: Create `research/clusters/README.md`**

```markdown
# Cluster Data

One JSON file per concept cluster, written during Phase 2 after all harvest files complete. See [`../README.md`](../README.md) for pipeline context.

## Schema

```json
{
  "slug": "kebab-case-cluster-name",
  "label": "Human-Readable Cluster Label",
  "department": "Department cluster label",
  "vocabulary": ["term1", "term2", "term3"],
  "sources": [
    { "institution": "MIT", "title": "Course title", "url": "https://..." }
  ],
  "app_prompts": []
}
````

`app_prompts` is filled in Phase 3. Each prompt should be close to 2000 tokens — detailed domain context, realistic scenario, exact vocabulary from `vocabulary`. No code advice, no styling dictation. See `agents/resource-harvest-to-pages.md` Phase 3 for full guidance and a worked example.

````

- [ ] **Step 4: Commit scaffolding**

```bash
git add research/
git commit -m "chore: scaffold research/ directory structure for syllabus harvest (#44)"
````

---

### Task 2: Harvest MIT OpenCourseWare (Northeast)

**Files:**

- Create: `research/harvest/mit-ocw.json`

Target: 6 syllabi across Data Science, Environmental Studies, Urban Planning, Public Health, Behavioral Economics, Education Research.

- [ ] **Step 1: Find Data Science / Stats syllabi**

Fetch in order until content is found:

1. `https://ocw.mit.edu/search/?d=Mathematics&q=statistics+causal+inference`
2. `https://r.jina.ai/https://ocw.mit.edu/search/?d=Electrical+Engineering+and+Computer+Science&q=machine+learning+statistics`

Good known targets (try direct fetch on each course URL):

- `https://ocw.mit.edu/courses/6-s897-machine-learning-for-healthcare-spring-2019/`
- `https://ocw.mit.edu/courses/14-32-econometrics-spring-2007/` (causal inference / IV)
- `https://ocw.mit.edu/courses/15-075j-statistical-thinking-and-data-analysis-fall-2011/`

For each: look for the "Syllabus" tab. Extract 4–8 specific technique/concept terms from the topics list or weekly schedule. Copy 1–3 verbatim sentences as `source_text`.

- [ ] **Step 2: Find Environmental Studies syllabi**

Try:

1. `https://r.jina.ai/https://ocw.mit.edu/search/?d=Civil+and+Environmental+Engineering&q=ecosystem`
2. `https://r.jina.ai/https://ocw.mit.edu/search/?d=Earth%2C+Atmospheric%2C+and+Planetary+Sciences`

Targets: courses covering ecosystem services, carbon accounting, life-cycle analysis, or environmental policy (2018–2025 preferred).

- [ ] **Step 3: Find Urban Planning syllabi**

Try: `https://r.jina.ai/https://ocw.mit.edu/search/?d=Urban+Studies+and+Planning`

Targets: GIS, zoning analysis, transit equity, land-use modeling, urban data analytics.

- [ ] **Step 4: Find Public Health / Behavioral Econ / Education syllabi**

- Public Health: `https://r.jina.ai/https://ocw.mit.edu/search/?d=Health+Sciences+and+Technology`
- Behavioral Econ: `https://r.jina.ai/https://ocw.mit.edu/search/?d=Economics&q=behavioral`
- Education: if no Education dept on OCW, substitute a Learning Sciences or cognition course and note `substitution_reason`.

- [ ] **Step 5: Apply fetch fallback chain for any failed URLs**

For each URL that returns an error, blocked page, or login wall:

1. Try `https://r.jina.ai/<url>`
2. Try `https://web.archive.org/web/2024/<url>`
3. Find a related course (same topic, different year or number)
4. If nothing works: `gh issue create --repo VibesDIY/landing-pages --title "Harvest: need help sourcing <dept> syllabus from MIT OCW" --body "Tried: <list of URLs>. Looking for: <topic> course with public syllabus 2022–2025."` and record `"fetch_method": "issue-filed"` with the issue URL.

- [ ] **Step 6: Write `research/harvest/mit-ocw.json`**

```json
{
  "source": "MIT OpenCourseWare",
  "location": "Cambridge, MA",
  "region": "Northeast",
  "fetched": "2026-05-18",
  "items": []
}
```

Fill in one object per syllabus. Minimum 5 items. Each `source_text` must contain the `topics` terms verbatim or near-verbatim — this is the "show your work" field.

- [ ] **Step 7: Validate JSON**

```bash
python3 -c "
import json, sys
with open('research/harvest/mit-ocw.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = []
for i, item in enumerate(d['items']):
    missing = [k for k in required if not item.get(k)]
    if missing:
        errors.append(f'Item {i} ({item.get(\"title\",\"?\")}): missing {missing}')
    if len(item.get('topics', [])) < 3:
        errors.append(f'Item {i}: fewer than 3 topics')
if errors:
    [print(e) for e in errors]
    sys.exit(1)
print(f'OK: {len(d[\"items\"])} items, all fields present')
"
```

Expected: `OK: N items, all fields present` with N ≥ 5.

- [ ] **Step 8: Commit**

```bash
git add research/harvest/mit-ocw.json
git commit -m "data: harvest MIT OCW syllabi (#44)"
```

---

### Task 3: Harvest Stanford University (West Coast)

**Files:**

- Create: `research/harvest/stanford-see.json`

Target: 5–6 syllabi. Stanford courses often live on faculty pages; the Stats and CS departments post public syllabi.

- [ ] **Step 1: Find Data Science / Stats syllabi**

Try in order:

1. `https://r.jina.ai/https://stats.stanford.edu/courses` — Stats department listing
2. `https://r.jina.ai/https://explorecourses.stanford.edu/search?q=causal+inference&view=catalog`
3. WebSearch: `site:stanford.edu syllabus "causal inference" 2023 OR 2024`

Good targets: STATS 209 (Causal Inference), CS 229 (ML — has public syllabus on cs229.stanford.edu), ECON 293.

- [ ] **Step 2: Find Environmental / Earth Systems syllabi**

Try:

1. `https://r.jina.ai/https://earth.stanford.edu/courses`
2. `https://r.jina.ai/https://sustainability.stanford.edu/`

Targets: Earth Systems, Environmental Data Science, carbon accounting.

- [ ] **Step 3: Find Urban / Public Health / Behavioral Econ / Education syllabi**

- Urban Studies: `https://r.jina.ai/https://urbanstudies.stanford.edu/courses`
- Public Health / Epidemiology: `https://r.jina.ai/https://med.stanford.edu/epidemiology.html`
- Behavioral Econ: GSB OB 628 or ECON 268
- Education: `https://r.jina.ai/https://ed.stanford.edu/academics/`

- [ ] **Step 4: Apply fetch fallback chain for any failed URLs** (same procedure as Task 2 Step 5)

- [ ] **Step 5: Write `research/harvest/stanford-see.json`**

```json
{
  "source": "Stanford University",
  "location": "Stanford, CA",
  "region": "West Coast",
  "fetched": "2026-05-18",
  "items": []
}
```

- [ ] **Step 6: Validate and commit**

```bash
python3 -c "
import json, sys
with open('research/harvest/stanford-see.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = [f'Item {i} ({item.get(\"title\",\"?\")}): missing {[k for k in required if not item.get(k)]}' for i, item in enumerate(d['items']) if any(not item.get(k) for k in required)]
if errors: [print(e) for e in errors]; sys.exit(1)
print(f'OK: {len(d[\"items\"])} items')
" && git add research/harvest/stanford-see.json && git commit -m "data: harvest Stanford syllabi (#44)"
```

---

### Task 4: Harvest UC Berkeley (West Coast)

**Files:**

- Create: `research/harvest/berkeley.json`

Berkeley has well-structured public course pages. Stats and Data Science departments are especially accessible.

- [ ] **Step 1: Find Stats / Data Science syllabi**

Try:

1. `https://r.jina.ai/https://statistics.berkeley.edu/courses/fall-2024`
2. `https://r.jina.ai/https://data.berkeley.edu/education/courses`

Targets: STAT 156 (Causal Inference), STAT 222, DATA 100 (Principles & Techniques of Data Science).

- [ ] **Step 2: Find Environmental / Public Health syllabi**

Try:

1. `https://r.jina.ai/https://nature.berkeley.edu/advising/courses`
2. `https://r.jina.ai/https://publichealth.berkeley.edu/academics/courses/mph-core-curriculum/`

Targets: PB HLTH 250C (Epidemiology Methods), ESPM 287 (Environmental Policy Analysis).

- [ ] **Step 3: Find City Planning / Behavioral Econ / Education syllabi**

Try:

1. `https://r.jina.ai/https://ced.berkeley.edu/academics/city-regional-planning/courses`
2. `https://r.jina.ai/https://are.berkeley.edu/courses` — Agricultural & Resource Econ (behavioral, environmental)
3. `https://r.jina.ai/https://gse.berkeley.edu/academics/courses`

- [ ] **Step 4: Apply fetch fallback chain, write, validate, commit**

```bash
# After writing research/harvest/berkeley.json:
python3 -c "
import json, sys
with open('research/harvest/berkeley.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = [f'Item {i}: missing {[k for k in required if not item.get(k)]}' for i, item in enumerate(d['items']) if any(not item.get(k) for k in required)]
if errors: [print(e) for e in errors]; sys.exit(1)
print(f'OK: {len(d[\"items\"])} items')
" && git add research/harvest/berkeley.json && git commit -m "data: harvest UC Berkeley syllabi (#44)"
```

---

### Task 5: Harvest Carnegie Mellon (Mid-Atlantic)

**Files:**

- Create: `research/harvest/cmu.json`

CMU is strong in Statistics, ML, Engineering & Public Policy (EPP), and Social & Decision Sciences (SDS). EPP covers environmental + public health from an engineering lens; SDS covers behavioral econ.

- [ ] **Step 1: Find Stats / ML syllabi**

Try:

1. `https://r.jina.ai/https://www.stat.cmu.edu/academics/courses.html`
2. `https://r.jina.ai/https://www.ml.cmu.edu/academics/courses.html`

Targets: 36-460 (Causal Inference), 10-701 (Introduction to ML), 36-750 (Statistics for Lab Sciences).

- [ ] **Step 2: Find EPP / SDS / Heinz syllabi**

Try:

1. `https://r.jina.ai/https://www.cmu.edu/epp/education/courses.html` — Engineering & Public Policy
2. `https://r.jina.ai/https://www.cmu.edu/dietrich/sds/courses/index.html` — Social & Decision Sciences
3. `https://r.jina.ai/https://www.cmu.edu/heinz/academics/courses/` — Heinz (urban, health policy)

- [ ] **Step 3: Apply fetch fallback chain, write, validate, commit**

```bash
python3 -c "
import json, sys
with open('research/harvest/cmu.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = [f'Item {i}: missing {[k for k in required if not item.get(k)]}' for i, item in enumerate(d['items']) if any(not item.get(k) for k in required)]
if errors: [print(e) for e in errors]; sys.exit(1)
print(f'OK: {len(d[\"items\"])} items')
" && git add research/harvest/cmu.json && git commit -m "data: harvest CMU syllabi (#44)"
```

---

### Task 6: Harvest UT Austin (South/Central)

**Files:**

- Create: `research/harvest/utexas.json`

UT Austin maintains a **public syllabi repository** — this is the highest-yield source in the plan.

- [ ] **Step 1: Explore UT Austin public syllabi repository**

Try:

1. `https://r.jina.ai/https://syllabi.registrar.utexas.edu/` — public syllabi repo
2. WebSearch: `site:utexas.edu syllabus "causal inference" OR "epidemiology" OR "urban planning" 2023..2025`

Filter for: Statistics (SDS), LBJ School of Public Affairs, Urban Planning, Population Health, Economics. Target semesters Fall 2022 through Spring 2025.

Good targets:

- SDS 384 / STA 388 (Causal Inference)
- URB 393 (Urban Studies seminar)
- PHL 325 or ECO 357 (Decision Theory / Behavioral)
- PH 393 / EP 353 (Epidemiology)
- ENV 393 or LBJ course on Environmental Policy

- [ ] **Step 2: Fetch individual syllabi (PDF handling)**

For PDF syllabi: try `https://r.jina.ai/<pdf-url>` first — Jina extracts text from standard-hosted PDFs. If Jina can't reach the PDF, try Wayback Machine. Extract the weekly topics section or readings list for `topics` and `source_text`.

- [ ] **Step 3: Apply fetch fallback chain, write, validate, commit**

```bash
python3 -c "
import json, sys
with open('research/harvest/utexas.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = [f'Item {i}: missing {[k for k in required if not item.get(k)]}' for i, item in enumerate(d['items']) if any(not item.get(k) for k in required)]
if errors: [print(e) for e in errors]; sys.exit(1)
print(f'OK: {len(d[\"items\"])} items')
" && git add research/harvest/utexas.json && git commit -m "data: harvest UT Austin syllabi (#44)"
```

---

### Task 7: Harvest UW Madison (Midwest)

**Files:**

- Create: `research/harvest/uw-madison.json`

UW Madison is particularly strong in Environmental Studies (Nelson Institute) and Statistics.

- [ ] **Step 1: Find Stats / Data Science syllabi**

Try:

1. `https://r.jina.ai/https://stat.wisc.edu/courses/`

Targets: STAT 741 (Causal Inference), STAT 610 (Statistical Inference), STAT 679 (Statistical Computing).

- [ ] **Step 2: Find Environmental / Public Health syllabi**

Try:

1. `https://r.jina.ai/https://nelson.wisc.edu/grad/academics/courses.php` — Nelson Institute
2. `https://r.jina.ai/https://pophealth.wisc.edu/education/courses/`

Targets: Nelson Institute environment/policy courses (ENVIR 400-level), POP HLTH 525 (Epidemiology).

- [ ] **Step 3: Find Urban / Education / Behavioral Econ syllabi**

Try:

1. `https://r.jina.ai/https://urpl.wisc.edu/courses/` — Urban & Regional Planning
2. `https://r.jina.ai/https://education.wisc.edu/academics/graduate/courses/`
3. `https://r.jina.ai/https://econ.wisc.edu/courses/`

- [ ] **Step 4: Apply fetch fallback chain, write, validate, commit**

```bash
python3 -c "
import json, sys
with open('research/harvest/uw-madison.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = [f'Item {i}: missing {[k for k in required if not item.get(k)]}' for i, item in enumerate(d['items']) if any(not item.get(k) for k in required)]
if errors: [print(e) for e in errors]; sys.exit(1)
print(f'OK: {len(d[\"items\"])} items')
" && git add research/harvest/uw-madison.json && git commit -m "data: harvest UW Madison syllabi (#44)"
```

---

### Task 8: Harvest UNC Chapel Hill (Southeast)

**Files:**

- Create: `research/harvest/unc-chapel-hill.json`

UNC is strong in Public Health (Gillings School — one of the top SPH programs in the US), City & Regional Planning, and Education Research.

- [ ] **Step 1: Find Public Health syllabi (Gillings School)**

Try:

1. `https://r.jina.ai/https://sph.unc.edu/resource/courses/`
2. WebSearch: `site:sph.unc.edu syllabus "causal inference" OR "epidemiology methods" 2023..2025`

Targets: EPID 718 (Causal Inference in Epidemiology), BIOS 600-series (Biostatistics), HPM 800-series (Health Policy & Management).

- [ ] **Step 2: Find City Planning / Education syllabi**

Try:

1. `https://r.jina.ai/https://planning.unc.edu/academics/courses/`
2. `https://r.jina.ai/https://soe.unc.edu/academics/courses/`

Targets: PLAN 710 (Urban Data Analytics), PLAN 672 (Land Use & Transportation), EDUC 800-level learning analytics or formative assessment courses.

- [ ] **Step 3: Find Stats / Behavioral Econ syllabi**

Try:

1. `https://r.jina.ai/https://stor.unc.edu/courses/` — Statistics & Operations Research
2. `https://r.jina.ai/https://econ.unc.edu/courses/` — Econ (behavioral if available)

- [ ] **Step 4: Apply fetch fallback chain, write, validate, commit**

```bash
python3 -c "
import json, sys
with open('research/harvest/unc-chapel-hill.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = [f'Item {i}: missing {[k for k in required if not item.get(k)]}' for i, item in enumerate(d['items']) if any(not item.get(k) for k in required)]
if errors: [print(e) for e in errors]; sys.exit(1)
print(f'OK: {len(d[\"items\"])} items')
" && git add research/harvest/unc-chapel-hill.json && git commit -m "data: harvest UNC Chapel Hill syllabi (#44)"
```

---

### Task 9: Harvest University of Washington (Pacific Northwest)

**Files:**
- Create: `research/harvest/uw-seattle.json`

UW Seattle is strong in CS, Environmental Science (College of the Environment), and Public Health (School of Public Health) — good cross-department coverage distinct from our other West Coast schools.

- [ ] **Step 1: Find Stats / Data Science syllabi**

Try:
1. `https://r.jina.ai/https://stat.uw.edu/courses`
2. `https://r.jina.ai/https://cs.uw.edu/academics/course-list`

Targets: STAT 534 (Statistical Computing), CSE 546 (ML), STAT 502 (Regression), STAT 528 (Survival Analysis).

- [ ] **Step 2: Find Environmental / Public Health syllabi**

Try:
1. `https://r.jina.ai/https://environment.uw.edu/students/current-students/courses/`
2. `https://r.jina.ai/https://sph.uw.edu/academics/courses`

Targets: ENVIR 450-level environmental policy or ecosystem services courses; EPIA 512 (Epidemiology), BIOST 517/518 (Biostatistics).

- [ ] **Step 3: Find Urban / Behavioral Econ / Education syllabi**

Try:
1. `https://r.jina.ai/https://urbdp.be.uw.edu/courses/` — Urban Design & Planning
2. `https://r.jina.ai/https://econ.uw.edu/courses` — Economics (behavioral)
3. `https://r.jina.ai/https://education.uw.edu/academics/courses` — College of Education

- [ ] **Step 4: Apply fetch fallback chain, write, validate, commit**

```bash
python3 -c "
import json, sys
with open('research/harvest/uw-seattle.json') as f:
    d = json.load(f)
required = ['title', 'department', 'year', 'url', 'fetch_method', 'topics', 'source_text']
errors = [f'Item {i}: missing {[k for k in required if not item.get(k)]}' for i, item in enumerate(d['items']) if any(not item.get(k) for k in required)]
if errors: [print(e) for e in errors]; sys.exit(1)
print(f'OK: {len(d[\"items\"])} items')
" && git add research/harvest/uw-seattle.json && git commit -m "data: harvest UW Seattle syllabi (#44)"
```

---

### Task 10: Final validation and summary

- [ ] **Step 1: Count total syllabi and check department coverage**

```bash
python3 -c "
import json, glob
files = sorted(glob.glob('research/harvest/*.json'))
total = 0
by_dept = {}
by_method = {}
for fpath in files:
    d = json.load(open(fpath))
    inst = d['source']
    count = len(d['items'])
    total += count
    print(f'{inst}: {count} items')
    for item in d['items']:
        dept = item.get('department', 'unknown')
        method = item.get('fetch_method', 'unknown')
        by_dept[dept] = by_dept.get(dept, 0) + 1
        by_method[method] = by_method.get(method, 0) + 1
print(f'\nTotal: {total} syllabi across {len(files)} institutions')
print('\nBy department:')
for dept, count in sorted(by_dept.items()): print(f'  {dept}: {count}')
print('\nBy fetch method:')
for method, count in sorted(by_method.items()): print(f'  {method}: {count}')
"
```

Expected: ≥40 total, ≥5 distinct departments, no unexplained gaps.

- [ ] **Step 2: Run build check**

```bash
pnpm check
```

Expected: `Done. Output in _site/` — no .hbs files changed so this always passes.

- [ ] **Step 3: Final commit for any loose ends**

```bash
git status
# If any README or scaffold files remain uncommitted:
git add research/ && git commit -m "docs: finalize research/ READMEs after harvest run (#44)" 2>/dev/null || echo "Nothing to commit — all clean"
```
