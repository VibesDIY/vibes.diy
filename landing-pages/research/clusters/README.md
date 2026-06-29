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
```

`app_prompts` is filled in Phase 3. Each prompt should be close to 2000 tokens — detailed domain context, realistic scenario, exact vocabulary from `vocabulary`. No code advice, no styling dictation. See `agents/resource-harvest-to-pages.md` Phase 3 for full guidance and a worked example.
