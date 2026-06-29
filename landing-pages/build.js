#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "_site");

// Clean output
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Helpers
Handlebars.registerHelper("urlencode", (s) =>
  encodeURIComponent(s == null ? "" : String(s)),
);
Handlebars.registerHelper("prompt64", (s) =>
  encodeURIComponent(
    Buffer.from(s == null ? "" : String(s), "utf8").toString("base64"),
  ),
);
Handlebars.registerHelper("numIdx", (i) =>
  String((typeof i === "number" ? i : 0) + 1).padStart(2, "0"),
);
// Whole days elapsed from a "YYYY-MM-DD" date until build time.
Handlebars.registerHelper("daysSince", (dateStr) => {
  const start = Date.parse(dateStr);
  if (Number.isNaN(start)) return "";
  return String(Math.floor((Date.now() - start) / 86400000));
});
// Approximate whole months elapsed from a "YYYY-MM-DD" date until build time.
Handlebars.registerHelper("monthsSince", (dateStr) => {
  const start = Date.parse(dateStr);
  if (Number.isNaN(start)) return "";
  const days = (Date.now() - start) / 86400000;
  return String(Math.round(days / 30.4375));
});
Handlebars.registerHelper("groupByCategory", (arr) => {
  if (!Array.isArray(arr)) return [];
  const map = new Map();
  for (const item of arr) {
    const cat = item.category || "Uncategorized";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(item);
  }
  return Array.from(map.entries()).map(([category, items]) => ({
    category,
    items,
  }));
});

// Register partials
const partialsDir = path.join(SRC, "partials");
for (const file of fs.readdirSync(partialsDir)) {
  if (!file.endsWith(".hbs")) continue;
  const name = path.basename(file, ".hbs");
  Handlebars.registerPartial(
    name,
    fs.readFileSync(path.join(partialsDir, file), "utf8"),
  );
}

// Load layouts
const layouts = {};
const layoutsDir = path.join(SRC, "layouts");
for (const file of fs.readdirSync(layoutsDir)) {
  if (!file.endsWith(".hbs")) continue;
  const name = path.basename(file, ".hbs");
  layouts[name] = Handlebars.compile(
    fs.readFileSync(path.join(layoutsDir, file), "utf8"),
  );
}

// Process pages
const pagesDir = path.join(SRC, "pages");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else if (e.name.endsWith(".hbs")) files.push(full);
  }
  return files;
}

const META_PIXEL_ID = "1310410873948425";

const BASE_URL = "https://good.vibes.diy";
const sitemapStream = fs.createWriteStream(path.join(OUT, "sitemap.ndjson"));
sitemapStream.write(
  JSON.stringify({
    type: "header",
    generated: new Date().toISOString(),
    baseUrl: BASE_URL,
    version: 1,
  }) + "\n",
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

  const html = layout({
    metaPixelId: META_PIXEL_ID,
    ...data,
    body: renderedBody,
  });
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
  const record = {
    type: "page",
    url: cleanUrl,
    path: htmlPath,
    section,
    title: data.title,
  };
  if (data.description) record.description = data.description;
  if (data.source) record.source = data.source;
  sitemapStream.write(JSON.stringify(record) + "\n");
}

sitemapStream.end();
console.log("  sitemap.ndjson written");

// Copy static assets
const statics = [
  "vibes-diy-logo.svg",
  "Vibes-Toggle-1-Transparent.png",
  "_headers",
  "specs",
];
// Also copy images/ if it exists
if (fs.existsSync(path.join(__dirname, "images"))) {
  statics.push("images");
}

for (const item of statics) {
  const src = path.join(__dirname, item);
  const dest = path.join(OUT, item);
  if (!fs.existsSync(src)) continue;
  if (fs.statSync(src).isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log(`\nDone. Output in _site/`);
