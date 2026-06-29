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
