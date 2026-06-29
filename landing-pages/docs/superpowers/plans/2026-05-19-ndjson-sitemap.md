# NDJSON Sitemap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream an NDJSON sitemap to `_site/sitemap.ndjson` as a side-effect of the existing build, exposing the site's information architecture to agents.

**Architecture:** Open a `WriteStream` before the page-walk loop in `build.js`, write a header record immediately, write one page record per successfully-built page inside the loop, close the stream after the loop. No array accumulation; data is written as it is processed. A separate verification script uses Node's `assert` to confirm the output shape.

**Tech Stack:** Node.js built-ins only — `fs.createWriteStream`, `JSON.stringify`, `assert`.

---

### Task 1: Write a failing verification script

**Files:**
- Create: `test-sitemap.js`

This script will fail until `build.js` generates the file. Run it first to confirm the failure, then again after implementation to confirm success.

- [ ] **Step 1: Create `test-sitemap.js`**

```js
#!/usr/bin/env node
const fs = require("fs");
const assert = require("assert");
const path = require("path");

const file = path.join(__dirname, "_site", "sitemap.ndjson");
assert.ok(fs.existsSync(file), "_site/sitemap.ndjson must exist");

const lines = fs.readFileSync(file, "utf8").trim().split("\n");
assert.ok(lines.length >= 2, "must have at least a header + one page record");

const header = JSON.parse(lines[0]);
assert.strictEqual(header.type, "header");
assert.ok(typeof header.generated === "string", "generated must be a string");
assert.strictEqual(header.baseUrl, "https://good.vibes.diy");
assert.strictEqual(header.version, 1);

for (const line of lines.slice(1)) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  assert.strictEqual(record.type, "page");
  assert.ok(record.url.startsWith("https://"), `url must be absolute: ${record.url}`);
  assert.ok(typeof record.path === "string", "path must be a string");
  assert.ok(typeof record.section === "string", "section must be a string");
  assert.ok(typeof record.title === "string", "title must be a string");
}

console.log(`OK — ${lines.length - 1} page records`);
```

- [ ] **Step 2: Run it to confirm failure**

```bash
node test-sitemap.js
```

Expected output (before build.js is modified):
```
AssertionError [ERR_ASSERTION]: _site/sitemap.ndjson must exist
```

---

### Task 2: Modify build.js to stream sitemap.ndjson

**Files:**
- Modify: `build.js:75-102`

Three insertion points:
1. Before the walk loop — open stream, write header
2. Inside the loop after `outFile` is written — write page record
3. After the loop — close stream

- [ ] **Step 1: Open the stream and write the header before the walk loop**

In `build.js`, replace line 75 (`for (const fullPath of walk(pagesDir)) {`) with:

```js
const BASE_URL = "https://good.vibes.diy";
const sitemapStream = fs.createWriteStream(path.join(OUT, "sitemap.ndjson"));
sitemapStream.write(
  JSON.stringify({ type: "header", generated: new Date().toISOString(), baseUrl: BASE_URL, version: 1 }) + "\n",
);

for (const fullPath of walk(pagesDir)) {
```

- [ ] **Step 2: Write a page record inside the loop**

In `build.js`, after `console.log(`  ${rel} -> ...`)` (currently line 101) and before the closing `}` of the for-loop (currently line 102), add:

```js
  const htmlPath = path.relative(OUT, outFile);
  const segments = rel.split(path.sep);
  const section = segments.length === 1 ? "root" : segments[0];
  const cleanUrl =
    data.ogUrl ||
    BASE_URL + "/" + htmlPath.replace(/\.html$/, "").replace(/\/index$/, "");
  const record = { type: "page", url: cleanUrl, path: htmlPath, section, title: data.title };
  if (data.description) record.description = data.description;
  if (data.source) record.source = data.source;
  sitemapStream.write(JSON.stringify(record) + "\n");
```

- [ ] **Step 3: Close the stream after the walk loop**

Immediately after the closing `}` of the walk `for`-loop (currently line 102), add:

```js
sitemapStream.end();
console.log("  sitemap.ndjson written");
```

The final shape of `build.js` around the walk loop will look like:

```js
const BASE_URL = "https://good.vibes.diy";
const sitemapStream = fs.createWriteStream(path.join(OUT, "sitemap.ndjson"));
sitemapStream.write(
  JSON.stringify({ type: "header", generated: new Date().toISOString(), baseUrl: BASE_URL, version: 1 }) + "\n",
);

for (const fullPath of walk(pagesDir)) {
  const rel = path.relative(pagesDir, fullPath);
  const raw = fs.readFileSync(fullPath, "utf8");

  const match = raw.match(/^\s*\{\{!--([\s\S]*?)--\}\}/);
  if (!match) {
    console.error(`No front-matter in ${rel}, skipping`);
    continue;
  }

  const data = JSON.parse(match[1]);
  const depth = rel.split(path.sep).length - 1;
  data.assetPrefix = depth === 0 ? "" : "../".repeat(depth);
  const bodySource = raw.slice(match[0].length);
  const renderedBody = Handlebars.compile(bodySource)(data);

  const layout = layouts[data.layout];
  if (!layout) {
    console.error(`Unknown layout "${data.layout}" in ${rel}, skipping`);
    continue;
  }

  const html = layout({ ...data, body: renderedBody });
  const outFile = path.join(OUT, rel.replace(/\.hbs$/, ".html"));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  console.log(`  ${rel} -> ${path.relative(OUT, outFile)}`);

  const htmlPath = path.relative(OUT, outFile);
  const segments = rel.split(path.sep);
  const section = segments.length === 1 ? "root" : segments[0];
  const cleanUrl =
    data.ogUrl ||
    BASE_URL + "/" + htmlPath.replace(/\.html$/, "").replace(/\/index$/, "");
  const record = { type: "page", url: cleanUrl, path: htmlPath, section, title: data.title };
  if (data.description) record.description = data.description;
  if (data.source) record.source = data.source;
  sitemapStream.write(JSON.stringify(record) + "\n");
}
sitemapStream.end();
console.log("  sitemap.ndjson written");
```

- [ ] **Step 4: Run the build**

```bash
pnpm check
```

Expected: build succeeds, last lines include `sitemap.ndjson written` and `Done. Output in _site/`.

- [ ] **Step 5: Run the verification script**

```bash
node test-sitemap.js
```

Expected:
```
OK — 76 page records
```

(Exact count may vary if some pages lack frontmatter and are skipped.)

- [ ] **Step 6: Spot-check the output**

```bash
head -3 _site/sitemap.ndjson
```

Expected — three lines, valid JSON on each:
```
{"type":"header","generated":"2026-05-19T...","baseUrl":"https://good.vibes.diy","version":1}
{"type":"page","url":"https://good.vibes.diy/...","path":"...html","section":"...","title":"..."}
{"type":"page","url":"https://good.vibes.diy/...","path":"...html","section":"...","title":"..."}
```

Also check a featured-apps page has the right section:
```bash
grep '"section":"featured-apps"' _site/sitemap.ndjson | head -2
```

- [ ] **Step 7: Commit**

```bash
git add build.js test-sitemap.js
git commit -m "feat: stream NDJSON sitemap to _site/sitemap.ndjson during build"
```

---

## Self-Review

**Spec coverage:**
- Header record with `type`, `generated`, `baseUrl`, `version` — covered in Task 2 Step 1
- Page records with `type`, `url`, `path`, `section`, `title`, `description?`, `source?` — covered in Task 2 Step 2
- `url` fallback (ogUrl → derived clean URL) — covered; `BASE_URL + "/" + htmlPath...` with index stripping
- `section` taxonomy — covered; top-level → `"root"`, otherwise first path segment
- Pages that fail frontmatter parse are skipped — existing `continue` statements already handle this, stream simply doesn't receive a record for them
- Stream opened before loop, closed after — covered
- Output at `_site/sitemap.ndjson` — covered

**Placeholder scan:** None found.

**Type consistency:**
- `sitemapStream` opened before loop, used inside loop, closed after loop — consistent
- `BASE_URL` defined once before loop, referenced in header and page records — consistent
- `record.description` and `record.source` conditionally included (not null) — matches spec's "omitted if absent" requirement
