#!/usr/bin/env node
/**
 * Parse humanities institution sections from syllabi.hbs and write
 * research/harvest/<slug>.json files for each, mirroring the STEM format.
 *
 * Usage: node scripts/extract-hum-harvest.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SYLLABI = path.join(ROOT, "src", "pages", "edu", "syllabi.hbs");
const OUT_DIR = path.join(ROOT, "research", "harvest");

// Which section IDs are humanities and what metadata to attach
const HUM_SECTIONS = {
  "hnet-diplo": {
    source: "H-Net H-Diplo",
    location: "Multi-institutional",
    region: "National",
    slug: "h-net-diplo",
  },
  "hnet-urban-latam": {
    source: "H-Net H-Urban + H-LatAm",
    location: "Multi-institutional",
    region: "National",
    slug: "h-net-urban",
  },
  "mit-ocw-humanities": {
    source: "MIT OCW — Humanities",
    location: "Cambridge, MA",
    region: "Northeast",
    slug: "mit-humanities",
  },
  "mit-ocw-shass": {
    source: "MIT OCW — SHASS",
    location: "Cambridge, MA",
    region: "Northeast",
    slug: "mit-shass",
  },
  sfpc: {
    source: "School for Poetic Computation",
    location: "New York, NY",
    region: "Northeast",
    slug: "sfpc",
  },
  "utexas-hb2504": {
    source: "UT Austin — HB2504",
    location: "Austin, TX",
    region: "South",
    slug: "ut-austin-hum",
  },
  "uw-madison-history": {
    source: "UW–Madison History Dept",
    location: "Madison, WI",
    region: "Midwest",
    slug: "uw-madison-history",
  },
};

const raw = fs.readFileSync(SYLLABI, "utf-8");

// ── Extract one <section> block by id ────────────────────────────────────
function extractSection(html, sectionId) {
  // Match from <section ... id="sectionId" ... > to the closing </section>
  const openRe = new RegExp(
    `<section[^>]+id="${sectionId}"[^>]*>([\\s\\S]*?)</section>`,
  );
  const m = html.match(openRe);
  return m ? m[0] : null;
}

// ── Parse courses from a section block ───────────────────────────────────
function parseCourses(sectionHtml) {
  const courseRe =
    /<div class="course"[^>]*data-dept="([^"]*)"[^>]*data-topics="([^"]*)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  const titleRe = /<span class="course-title">([\s\S]*?)<\/span>/;
  const srcRe = /<a href="([^"]*)" [^>]*class="src"/;
  const metaRe = /class="course-meta">([\s\S]*?)<\/div>/;

  const courses = [];
  let m;
  while ((m = courseRe.exec(sectionHtml)) !== null) {
    const dept = m[1].trim();
    const topicsStr = m[2].trim();
    const inner = m[3];

    const titleMatch = inner.match(titleRe);
    const srcMatch = inner.match(srcRe);
    const metaMatch = inner.match(metaRe);

    if (!titleMatch) continue;

    const title = titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    const url = srcMatch ? srcMatch[1] : "";
    const yearMatch = metaMatch ? metaMatch[1].match(/·\s*(\d{4})/) : null;
    const year = yearMatch ? parseInt(yearMatch[1]) : 0;

    // Topics: split on spaces but preserve multi-word phrases from tags
    const tagRe = /<span class="tag">([\s\S]*?)<\/span>/g;
    const topics = [];
    let tagM;
    while ((tagM = tagRe.exec(inner)) !== null) {
      topics.push(tagM[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim());
    }

    const deptLabel = metaMatch
      ? metaMatch[1].split("·")[0].trim()
      : dept;

    courses.push({ title, department: deptLabel, year, url, topics });
  }
  return courses;
}

// ── Main ─────────────────────────────────────────────────────────────────
let written = 0;
for (const [sectionId, meta] of Object.entries(HUM_SECTIONS)) {
  const section = extractSection(raw, sectionId);
  if (!section) {
    console.warn(`⚠  Section #${sectionId} not found`);
    continue;
  }
  const items = parseCourses(section);
  if (!items.length) {
    console.warn(`⚠  No courses parsed from #${sectionId}`);
    continue;
  }

  const payload = {
    source: meta.source,
    location: meta.location,
    region: meta.region,
    domain: "humanities",
    fetched: "2026-05-20",
    items,
  };

  const outPath = path.join(OUT_DIR, `${meta.slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`  ✓ ${meta.slug}.json  (${items.length} courses)`);
  written++;
}

console.log(`\nWrote ${written} humanities harvest files.`);
