#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const matter = require("gray-matter");
const { marked } = require("marked");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "_site");

// Render fenced code blocks with the post style's lang label + escaped body.
// Written to tolerate both the (code, infostring) and ({ text, lang }) renderer
// signatures across marked majors.
function renderCodeBlock(codeOrToken, infostring) {
  let code, lang;
  if (codeOrToken && typeof codeOrToken === "object") {
    code = codeOrToken.text;
    lang = codeOrToken.lang;
  } else {
    code = codeOrToken;
    lang = infostring;
  }
  lang = (lang || "").trim().split(/\s+/)[0];
  const escaped = String(code == null ? "" : code)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const label = lang ? `<span class="lang">${lang}</span>` : "";
  return `<pre>${label}<code>${escaped}</code></pre>\n`;
}
// marked passes raw HTML through by default (no sanitize), so posts can embed
// figures, A/B grids, tables, and <iframe> vibe demos as raw HTML.
marked.use({ renderer: { code: renderCodeBlock } });

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// Format a YAML date (js-yaml gives a Date) as "June 9, 2026", read in UTC so
// a midnight-UTC date never slips to the previous day.
function formatDate(value) {
  const d = new Date(value);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
function xmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

// ---- Blog pass: markdown posts -> HTML, generated index, Atom + RSS feeds ----
const postsDir = path.join(SRC, "posts");
const blogOut = path.join(OUT, "blog");
const BLOG_TITLE = "Vibes DIY Blog";
const BLOG_SUBTITLE =
  "Field notes, evals, and stories from building the no-code app builder that turns a sentence into a working app.";
const BLOG_URL = `${BASE_URL}/blog/`;

if (fs.existsSync(postsDir)) {
  fs.mkdirSync(blogOut, { recursive: true });

  const posts = [];
  for (const file of fs.readdirSync(postsDir)) {
    if (!file.endsWith(".md")) continue;
    const slug = path.basename(file, ".md");
    const { data, content } = matter(
      fs.readFileSync(path.join(postsDir, file), "utf8"),
    );
    if (data.draft) continue;
    if (!data.date) {
      console.error(`Post ${file} has no date, skipping`);
      continue;
    }
    posts.push({
      slug,
      title: data.title || slug,
      date: new Date(data.date),
      summary: data.summary || "",
      description: data.description || data.summary || "",
      author: data.author || "Vibes DIY",
      thumb: data.thumb || null,
      glyph: data.glyph || "// the build log",
      html: marked.parse(content),
    });
  }

  // Canonical post list: newest first.
  posts.sort((a, b) => b.date - a.date);

  // Per-post pages.
  for (const post of posts) {
    const rendered = layouts["blog-post"]({
      metaPixelId: META_PIXEL_ID,
      title: `${post.title} | ${BLOG_TITLE}`,
      heading: post.title,
      description: post.description,
      ogUrl: `${BASE_URL}/blog/${post.slug}`,
      ogImage: post.thumb ? BASE_URL + post.thumb : undefined,
      displayDate: formatDate(post.date),
      author: post.author,
      body: post.html,
    });
    const outFile = path.join(blogOut, `${post.slug}.html`);
    fs.writeFileSync(outFile, rendered);
    console.log(`  posts/${post.slug}.md -> blog/${post.slug}.html`);

    sitemapStream.write(
      JSON.stringify({
        type: "page",
        url: `${BASE_URL}/blog/${post.slug}`,
        path: `blog/${post.slug}.html`,
        section: "blog",
        title: post.title,
        description: post.summary || undefined,
        source: `blog-${post.slug}`,
      }) + "\n",
    );
  }

  // Generated index.
  const indexHtml = layouts["blog-index"]({
    metaPixelId: META_PIXEL_ID,
    title: `${BLOG_TITLE} | Notes from the build log`,
    description: BLOG_SUBTITLE,
    ogUrl: BLOG_URL,
    posts: posts.map((p) => ({
      slug: p.slug,
      heading: p.title,
      summary: p.summary,
      thumb: p.thumb,
      glyph: p.glyph,
      displayDate: formatDate(p.date),
    })),
  });
  fs.writeFileSync(path.join(blogOut, "index.html"), indexHtml);
  console.log("  blog/index.html written");
  sitemapStream.write(
    JSON.stringify({
      type: "page",
      url: BLOG_URL.replace(/\/$/, ""),
      path: "blog/index.html",
      section: "blog",
      title: BLOG_TITLE,
      source: "blog-index",
    }) + "\n",
  );

  // Feeds (summary entries) from the same sorted post list.
  const updated = posts.length ? posts[0].date.toISOString() : new Date(0).toISOString();
  const atom = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${xmlEscape(BLOG_TITLE)}</title>`,
    `  <subtitle>${xmlEscape(BLOG_SUBTITLE)}</subtitle>`,
    `  <link href="${BASE_URL}/blog/feed.xml" rel="self"/>`,
    `  <link href="${BLOG_URL}"/>`,
    `  <id>${BLOG_URL}</id>`,
    `  <updated>${updated}</updated>`,
    ...posts.map((p) => {
      const url = `${BASE_URL}/blog/${p.slug}.html`;
      const iso = p.date.toISOString();
      return [
        "  <entry>",
        `    <title>${xmlEscape(p.title)}</title>`,
        `    <link href="${url}"/>`,
        `    <id>${url}</id>`,
        `    <updated>${iso}</updated>`,
        `    <published>${iso}</published>`,
        `    <author><name>${xmlEscape(p.author)}</name></author>`,
        `    <summary>${xmlEscape(p.summary)}</summary>`,
        "  </entry>",
      ].join("\n");
    }),
    "</feed>",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(blogOut, "feed.xml"), atom);

  const rss = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xmlEscape(BLOG_TITLE)}</title>`,
    `    <link>${BLOG_URL}</link>`,
    `    <description>${xmlEscape(BLOG_SUBTITLE)}</description>`,
    `    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>`,
    `    <lastBuildDate>${posts.length ? posts[0].date.toUTCString() : new Date(0).toUTCString()}</lastBuildDate>`,
    ...posts.map((p) => {
      const url = `${BASE_URL}/blog/${p.slug}.html`;
      return [
        "    <item>",
        `      <title>${xmlEscape(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${p.date.toUTCString()}</pubDate>`,
        `      <description>${xmlEscape(p.summary)}</description>`,
        "    </item>",
      ].join("\n");
    }),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(blogOut, "rss.xml"), rss);
  console.log(`  blog feeds written (${posts.length} posts): feed.xml + rss.xml`);
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
