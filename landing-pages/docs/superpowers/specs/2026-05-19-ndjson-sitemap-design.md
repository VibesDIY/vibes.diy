# NDJSON Sitemap for good.vibes.diy

**Date:** 2026-05-19  
**Status:** Approved

## Goal

Expose the information architecture of good.vibes.diy as a machine-readable NDJSON stream so agents can discover all pages without scraping HTML.

## Output

`_site/sitemap.ndjson` — written as a streaming side-effect of the existing build.

## Record format

**Line 1 — header:**
```json
{"type":"header","generated":"<ISO timestamp>","baseUrl":"https://good.vibes.diy","version":1}
```

**Lines 2–N — page records:**
```json
{"type":"page","url":"<ogUrl or derived>","path":"<rel path in _site>","section":"<directory>","title":"<frontmatter title>","description":"<frontmatter description>","source":"<frontmatter source>"}
```

Field rules:
- `url`: use `ogUrl` from frontmatter when present; fall back to `baseUrl + "/" + path` (strip `.html` suffix for clean URLs)
- `path`: relative path within `_site/` (e.g. `featured-apps/party-games.html`)
- `section`: first path segment of `rel` — `"root"` for top-level pages
- `title`, `description`, `source`: pulled directly from frontmatter; omitted (not null) if absent
- Pages that fail frontmatter parse are skipped (same as today in build.js)

## Implementation — changes to build.js

1. Before the walk loop: open a `fs.createWriteStream('_site/sitemap.ndjson')` and write the header record.
2. Inside the loop, after frontmatter is parsed and `outFile` is known: write one page record to the stream.
3. After the loop: close the stream (call `stream.end()`).
4. No array accumulation; each entry is written immediately.

No new dependencies. Node's built-in `fs.createWriteStream` handles streaming.

## Consumption

An agent fetches `https://good.vibes.diy/sitemap.ndjson` and processes:
```js
const lines = text.trim().split('\n').map(JSON.parse);
const header = lines[0];   // {type:'header', ...}
const pages  = lines.slice(1); // [{type:'page', url, title, ...}, ...]
```

## Section taxonomy

| Directory prefix | `section` value |
|---|---|
| (top-level) | `root` |
| `featured-apps/` | `featured-apps` |
| `expressions/` | `expressions` |
| `edu/` | `edu` |
| `arcade/` | `arcade` |
| `games/` | `games` |
| any other | first path segment |

## Out of scope

- App-level data (slugs, vibes.diy URLs) within featured-apps pages — pages-only per decision
- XML sitemap — NDJSON only
- Incremental/watch-mode streaming — file is rewritten on each full build
