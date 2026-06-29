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

### fetch_method values

| Value | Meaning |
|---|---|
| `direct` | WebFetch on canonical URL |
| `jina` | `https://r.jina.ai/<url>` markdown proxy |
| `wayback` | `https://web.archive.org/web/<year>/<url>` |
| `substituted` | Related resource used; add `substituted_for` + `substitution_reason` fields |
| `issue-filed` | All options exhausted; add `issue_url` field pointing to the GitHub issue |
