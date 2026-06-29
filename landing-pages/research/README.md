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

| File | Institution | Items | Status |
|---|---|---|---|
| `harvest/mit-ocw.json` | MIT OpenCourseWare | 6 | ✓ complete |
| `harvest/stanford-see.json` | Stanford University | 6 | ✓ complete |
| `harvest/berkeley.json` | UC Berkeley | 6 | ✓ complete |
| `harvest/cmu.json` | Carnegie Mellon University | 6 | ✓ complete |
| `harvest/utexas.json` | UT Austin | 6 | ✓ complete |
| `harvest/uw-madison.json` | UW Madison | 6 | ✓ complete |
| `harvest/unc-chapel-hill.json` | UNC Chapel Hill | 6 | ✓ complete |
| `harvest/uw-seattle.json` | University of Washington | 6 | ✓ complete |

**Total: 48 syllabi, 8 institutions, 6 departments**

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
