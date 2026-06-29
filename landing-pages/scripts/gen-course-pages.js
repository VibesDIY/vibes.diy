#!/usr/bin/env node
/**
 * Generate one .hbs page per course in research/harvest/*.json
 * Each page includes app cards from the matching cluster(s).
 *
 * Cluster app data is read live from src/pages/edu/<cluster>.hbs frontmatter
 * (the cluster JSONs only have raw app_prompts, not deployed metadata).
 *
 * Output:  src/pages/edu/<inst-slug>/<course-slug>.hbs
 * Manifest: research/course-page-manifest.json
 *
 * Usage: node scripts/gen-course-pages.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HARVEST_DIR = path.join(ROOT, "research", "harvest");
const EDU_DIR = path.join(ROOT, "src", "pages", "edu");

// ── Institution slug mapping (informal, SEO-friendly) ──────────────────────
const INST_SLUGS = {
  // STEM
  "UC Berkeley": "cal-berkeley",
  "Carnegie Mellon University": "cmu",
  "MIT OpenCourseWare": "mit",
  "Stanford University": "stanford",
  "UNC Chapel Hill": "unc",
  "University of Texas at Austin": "ut-austin",
  "University of Wisconsin–Madison": "uw-madison",
  "University of Washington": "uw-seattle",
  // Humanities
  "H-Net H-Diplo": "h-net-diplo",
  "H-Net H-Urban + H-LatAm": "h-net-urban",
  "MIT OCW — Humanities": "mit-humanities",
  "MIT OCW — SHASS": "mit-shass",
  "School for Poetic Computation": "sfpc",
  "UT Austin — HB2504": "ut-austin-hum",
  "UW–Madison History Dept": "uw-madison-history",
};

const INST_NAMES = {
  // STEM
  "cal-berkeley": "UC Berkeley",
  cmu: "Carnegie Mellon",
  mit: "MIT OpenCourseWare",
  stanford: "Stanford",
  unc: "UNC Chapel Hill",
  "ut-austin": "UT Austin",
  "uw-madison": "UW–Madison",
  "uw-seattle": "UW Seattle",
  // Humanities
  "h-net-diplo": "H-Net H-Diplo",
  "h-net-urban": "H-Net H-Urban + H-LatAm",
  "mit-humanities": "MIT OCW — Humanities",
  "mit-shass": "MIT OCW — SHASS",
  sfpc: "SFPC",
  "ut-austin-hum": "UT Austin — Humanities",
  "uw-madison-history": "UW–Madison History",
};

// ── Cluster definitions — slug must match the .hbs filename in src/pages/edu/
const CLUSTERS = [
  {
    label: "Behavioral Economics",
    slug: "behavioral-economics",
    matches: [
      "Behavioral Economics",
      "Psychology and Economics",
      "Foundations of Psychology",
      "Cost-Benefit Analysis",
      "Management Science",
    ],
  },
  {
    label: "Causal Inference",
    slug: "causal-inference",
    matches: ["Causal Inference", "Applied Quasi-Experimental", "Econometrics"],
  },
  {
    label: "Climate & Environment",
    slug: "climate-change-policy",
    matches: [
      "Climate Change",
      "Climate Justice",
      "Preserving Nature",
      "Engineering for Sustainability",
    ],
  },
  {
    label: "Epidemiology",
    slug: "epidemiology-study-design",
    matches: ["Epidemiology", "Epidemic Intelligence", "Biostatistics"],
  },
  {
    label: "Machine Learning",
    slug: "machine-learning-methods",
    matches: [
      "Machine Learning",
      "Statistical Machine Learning",
      "Data Science",
    ],
  },
  {
    label: "Policy Analysis",
    slug: "policy-analysis-decision-modeling",
    matches: [
      "Policy Analysis",
      "Cost-Benefit Analysis",
      "Decision Modeling",
      "Management Science",
    ],
  },
  {
    label: "Research Methods",
    slug: "research-methods-regression",
    matches: [
      "Multilevel Modeling",
      "Quantitative and Qualitative Research",
      "Methods of Educational Research",
      "Applied Biostatistics",
      "Quantitative Methods in Urban",
      "Statistical Computing",
    ],
  },
  {
    label: "Spatial Analysis & GIS",
    slug: "spatial-analysis-gis",
    matches: [
      "Geographic Information Systems",
      "Urban GIS",
      "Advanced Geographic",
      "Workshop on Geographic",
    ],
  },
  {
    label: "Urban Land Use",
    slug: "urban-land-use-planning",
    matches: ["Land Use", "City Planning", "Urban Transportation Planning"],
  },
  {
    label: "Literary Analysis",
    slug: "literary-analysis",
    matches: [
      "Foundations of World Culture",
      "Introduction to Fiction",
      "Writing About Literature",
      "British Literature",
    ],
  },
  {
    label: "Cold War History",
    slug: "cold-war-history",
    matches: [
      "Rethinking Cold War History",
      "History of U.S. Foreign Policy",
      "The Cold War",
      "American History Since 1865",
    ],
  },
  {
    label: "Critical Algorithms",
    slug: "critical-algorithms",
    matches: ["Code Societies", "Surveillance Studies", "Black Mirrors"],
  },
  {
    label: "Slavery & Civil Rights",
    slug: "slavery-civil-rights",
    matches: ["Slavery, Civil War", "African American History", "Race, Immigration"],
  },
  {
    label: "US Foreign Policy",
    slug: "us-foreign-policy",
    matches: [
      "U.S. Foreign Policy",
      "Diplomatic History",
      "U.S. Foreign Relations",
      "The U.S. and the Modern World",
    ],
  },
  {
    label: "Urban, Race & Housing",
    slug: "urban-race-housing",
    matches: ["New Suburban History", "History of Urban Problems"],
  },
  {
    label: "Latin American History",
    slug: "latin-american-history",
    matches: [
      "Central American History",
      "Reform and Revolution in Latin America",
      "Colonial Latin American History",
      "Aztec Art",
    ],
  },
  {
    label: "Ethics & Philosophy",
    slug: "ethics-philosophy",
    matches: [
      "Problems of Philosophy",
      "Ethics and Politics of Food",
      "Early Modern Philosophy",
    ],
  },
  {
    label: "Revolutions & Political Change",
    slug: "revolutions-political-change",
    matches: ["How to Stage a Revolution"],
  },
  {
    label: "Capitalism & Labor",
    slug: "capitalism-labor-history",
    matches: ["History of American Capitalism", "Foundations of Western Culture"],
  },
  {
    label: "Gender, Race & Colonialism",
    slug: "gender-colonialism",
    matches: [
      "Gender, Race and Colonialism",
      "The Caribbean and its Diasporas",
    ],
  },
  {
    label: "Music, Sound & Culture",
    slug: "music-sound-culture",
    matches: [
      "Musical Improvisation",
      "Jazz Appreciation",
      "Magical and Divinatory",
    ],
  },
  {
    label: "Algorithmic Writing",
    slug: "algorithmic-creative-writing",
    matches: ["Unfinished Sentence", "Computational Exploration"],
  },
];

// ── Load cluster app data from .hbs frontmatter ───────────────────────────
function loadClusterApps() {
  const FM_RE = /^\s*\{\{!--([\s\S]*?)--\}\}/;
  const map = {}; // slug → { label, apps[] }

  for (const cluster of CLUSTERS) {
    const hbsPath = path.join(EDU_DIR, `${cluster.slug}.hbs`);
    if (!fs.existsSync(hbsPath)) continue;
    try {
      const raw = fs.readFileSync(hbsPath, "utf-8");
      const m = raw.match(FM_RE);
      if (!m) continue;
      const data = JSON.parse(m[1]);
      if (Array.isArray(data.apps) && data.apps.length) {
        map[cluster.slug] = { label: cluster.label, apps: data.apps };
      }
    } catch {
      // skip unparseable files
    }
  }
  return map;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function findClusters(title) {
  return CLUSTERS.filter((c) => c.matches.some((m) => title.includes(m)));
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── App card HTML ─────────────────────────────────────────────────────────
function renderAppCards(clusterSlug, clusterLabel, apps) {
  const cards = apps
    .map((app) => {
      const vibe = `https://vibes.diy/vibe/${esc(app.author)}/${esc(app.slug)}`;
      const clone = `https://vibes.diy/clone/${esc(app.author)}/${esc(app.slug)}`;
      const remix = `https://vibes.diy/remix/${esc(app.author)}/${esc(app.slug)}`;
      const shot = `https://${esc(app.slug)}--${esc(app.author)}.prod-v2.vibesdiy.net/screenshot.jpg`;
      const fallback = `this.onerror=null;this.src='../../../images/og-preview.png'`;
      const liveTag = app.live ? `<span class="app-live-tag">live</span>` : "";
      return `<div class="app-card">
        <div class="app-card-header">
          <span class="app-card-num">${esc(app.num)}</span>
          <div class="app-card-meta">
            <a href="${vibe}" target="_blank" rel="noopener" class="app-card-title">${esc(app.title)}</a>${liveTag}
            <div class="app-card-tagline">${esc(app.tagline)}</div>
          </div>
        </div>
        <a href="${vibe}" target="_blank" rel="noopener" class="app-shot-wrap">
          <img src="${shot}" alt="${esc(app.title)} screenshot" loading="lazy" onerror="${fallback}">
        </a>
        <div class="app-card-actions">
          <a href="${vibe}" target="_blank" rel="noopener" class="act-btn act-open">Open</a>
          <a href="${clone}" target="_blank" rel="noopener" class="act-btn">Clone</a>
          <a href="${remix}" target="_blank" rel="noopener" class="act-btn">Remix</a>
        </div>
      </div>`;
    })
    .join("\n");

  return `<div class="apps-block">
    <div class="apps-block-header">
      <span class="section-label">Apps — ${esc(clusterLabel)}</span>
      <a href="../${esc(clusterSlug)}.html" class="cluster-full-link">full cluster →</a>
    </div>
    <div class="apps-grid">
      ${cards}
    </div>
  </div>`;
}

// ── Page template ─────────────────────────────────────────────────────────
function buildPage(inst, course, instSlug, courseSlug, clusters, clusterAppsMap) {
  const instName = INST_NAMES[instSlug] || inst.source;
  const canonicalUrl = `https://good.vibes.diy/edu/${instSlug}/${courseSlug}/`;
  const pageTitle = `${course.title} | ${instName} | Vibes DIY Edu`;
  const metaDesc = `${course.title} (${course.department}, ${course.year}) — ${course.topics.slice(0, 4).join(", ")} and more. Linked to Vibes DIY study tools.`;

  const topicsHtml = course.topics
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join("\n      ");

  const clusterChiclets = clusters.length
    ? clusters
        .map(
          (c) =>
            `<a href="../${esc(c.slug)}.html" class="cluster-link">${esc(c.label)}</a>`,
        )
        .join("\n      ")
    : "";

  const appsHtml = clusters
    .filter((c) => clusterAppsMap[c.slug])
    .map((c) => {
      const { label, apps } = clusterAppsMap[c.slug];
      return renderAppCards(c.slug, label, apps);
    })
    .join("\n");

  const breadcrumb = `<a href="../syllabi.html">Syllabi</a> <span class="sep">/</span> <a href="index.html">${esc(instName)}</a> <span class="sep">/</span> ${esc(course.title)}`;

  return `{{!--
{
  "layout": "webring",
  "title": "${pageTitle.replace(/"/g, '\\"')}",
  "description": "${metaDesc.replace(/"/g, '\\"')}",
  "ogUrl": "${canonicalUrl}"
}
--}}
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  background: #f4f4f0;
  color: #1a1a1a;
  font-size: 14px;
  line-height: 1.5;
}
.topbar {
  position: sticky; top: 0; z-index: 100;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 1.25rem;
  background: #231F20; color: #FFFFF0;
  border-bottom: 2px solid #000;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
}
.topbar a { color: inherit; text-decoration: none; opacity: 0.7; }
.topbar a:hover { opacity: 1; }
.topbar .sep { opacity: 0.35; margin: 0 0.4rem; }
.topbar-logo { height: 22px; width: auto; opacity: 0.85; vertical-align: middle; margin-right: 0.5rem; }
.wrap { max-width: 860px; margin: 0 auto; padding: 2rem 1.25rem 5rem; }
.breadcrumb { font-size: 0.75rem; color: #888; margin-bottom: 1.5rem; }
.breadcrumb a { color: #0070c9; text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb .sep { opacity: 0.5; margin: 0 0.3rem; }
.course-card {
  background: white;
  border: 2px solid #231F20;
  border-radius: 10px;
  padding: 1.5rem 1.75rem;
  margin-bottom: 1.5rem;
}
.course-title { font-size: 1.4rem; font-weight: 800; line-height: 1.2; margin-bottom: 0.5rem; }
.course-meta { font-size: 0.8rem; color: #666; margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.6rem; }
.meta-pill {
  background: #f4f4f0; border: 1px solid #ccc; border-radius: 4px;
  padding: 0.15rem 0.5rem; font-size: 0.72rem;
}
.section-label {
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: #999; margin-bottom: 0.6rem;
}
.tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 1.25rem; }
.tag {
  font-size: 0.7rem; padding: 0.15rem 0.45rem;
  background: rgba(35,31,32,0.06); border: 1px solid rgba(35,31,32,0.15);
  border-radius: 3px; color: #444;
}
.source-link {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.78rem; font-weight: 600; color: #0070c9;
  text-decoration: none; padding: 0.35rem 0.75rem;
  border: 1.5px solid #0070c9; border-radius: 5px;
  transition: background 0.12s, color 0.12s;
}
.source-link:hover { background: #0070c9; color: white; }
.cluster-section { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid #eee; }
.cluster-links { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
.cluster-link {
  display: inline-flex; align-items: center; gap: 0.25rem;
  font-size: 0.72rem; font-weight: 600;
  padding: 0.2rem 0.6rem;
  background: rgba(0,112,201,0.07); border: 1.5px solid #0070c9;
  color: #0070c9; border-radius: 4px; text-decoration: none;
  transition: background 0.12s, color 0.12s;
}
.cluster-link:hover { background: #0070c9; color: white; }
.cluster-link::after { content: " →"; font-size: 0.6rem; opacity: 0.7; }

/* ── App cards ── */
.apps-block { margin-bottom: 2rem; }
.apps-block-header {
  display: flex; justify-content: space-between; align-items: baseline;
  margin-bottom: 0.75rem; padding-bottom: 0.4rem;
  border-bottom: 2px solid #231F20;
}
.cluster-full-link {
  font-size: 0.72rem; font-weight: 700; color: #0070c9; text-decoration: none;
}
.cluster-full-link:hover { text-decoration: underline; }
.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}
.app-card {
  background: white;
  border: 1.5px solid #231F20;
  border-radius: 8px;
  overflow: hidden;
  display: flex; flex-direction: column;
}
.app-card-header {
  display: flex; gap: 0.6rem; align-items: flex-start;
  padding: 0.9rem 0.9rem 0.6rem;
}
.app-card-num {
  font-size: 1.5rem; font-weight: 800; color: #ccc;
  line-height: 1; flex-shrink: 0; margin-top: 0.1rem;
}
.app-card-meta { flex: 1; min-width: 0; }
.app-card-title {
  display: block; font-size: 0.9rem; font-weight: 700; color: #1a1a1a;
  text-decoration: none; line-height: 1.25; margin-bottom: 0.2rem;
}
.app-card-title:hover { color: #0070c9; }
.app-live-tag {
  display: inline-block; font-size: 0.55rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  background: #0070c9; color: white; padding: 1px 4px; border-radius: 2px;
  vertical-align: middle; margin-left: 0.3rem;
}
.app-card-tagline {
  font-size: 0.72rem; color: #666; line-height: 1.4; font-style: italic;
}
.app-shot-wrap {
  display: block; aspect-ratio: 16/9; overflow: hidden;
  background: #f4f4f0; border-top: 1px solid #eee; border-bottom: 1px solid #eee;
}
.app-shot-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.app-shot-wrap:hover img { transform: scale(1.03); }
.app-card-actions {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid #eee;
}
.act-btn {
  display: block; text-align: center; padding: 0.45rem 0.25rem;
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: #555; text-decoration: none; border-right: 1px solid #eee;
  transition: background 0.1s, color 0.1s;
}
.act-btn:last-child { border-right: none; }
.act-btn:hover { background: #0070c9; color: white; }
.act-btn.act-open { color: #0070c9; }

/* ── CTA ── */
.cta-card {
  background: #231F20; color: #FFFFF0;
  border-radius: 10px; padding: 1.25rem 1.75rem;
  margin-bottom: 1.25rem;
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;
}
.cta-card p { font-size: 0.85rem; opacity: 0.85; max-width: 480px; }
.cta-btn {
  display: inline-block;
  background: #FEDD00; color: #231F20;
  font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
  padding: 0.5rem 1.1rem; border-radius: 5px; text-decoration: none; white-space: nowrap;
}
.cta-btn:hover { background: #ffea47; }
.footer { text-align: center; padding: 2rem 1rem; font-size: 0.78rem; color: #999; border-top: 1px solid #ccc; margin-top: 2rem; }
.footer a { color: inherit; }
</style>

<nav class="topbar">
  <div>
    <a href="https://links.vibes.diy/homepage"><img src="{{assetPrefix}}Vibes-Toggle-1-Transparent.png" alt="Vibes DIY" class="topbar-logo"></a>
    <span class="sep">/</span>
    <a href="../syllabi.html">Edu Portal</a>
    <span class="sep">/</span>
    <a href="index.html">${esc(instName)}</a>
  </div>
  <div>${esc(course.year ? String(course.year) : "")}</div>
</nav>

<div class="wrap">
  <div class="breadcrumb">${breadcrumb}</div>

  <div class="course-card">
    <div class="course-title">${esc(course.title)}</div>
    <div class="course-meta">
      <span class="meta-pill">${esc(instName)}</span>
      <span class="meta-pill">${esc(course.department)}</span>
      <span class="meta-pill">${esc(String(course.year))}</span>
    </div>

    <div class="section-label">Topics</div>
    <div class="tags">
      ${topicsHtml}
    </div>

    ${course.url ? `<a href="${esc(course.url)}" target="_blank" rel="noopener" class="source-link">View syllabus ↗</a>` : ""}

    ${
      clusters.length
        ? `<div class="cluster-section">
      <div class="section-label">Related clusters</div>
      <div class="cluster-links">
        ${clusterChiclets}
      </div>
    </div>`
        : ""
    }
  </div>

  ${appsHtml}

  <div class="cta-card">
    <p>Build flashcard decks, quiz tools, or study apps for any of these topics — no code needed.</p>
    <a href="https://links.vibes.diy/homepage" class="cta-btn">Try Vibes DIY</a>
  </div>
</div>

<footer class="footer">
  <a href="https://links.vibes.diy/homepage">Vibes DIY</a> — build your own app from any topic in this corpus
</footer>
`;
}

// ── Institution index page ────────────────────────────────────────────────
function buildInstPage(instData, instSlug, coursesWithMeta) {
  const instName = INST_NAMES[instSlug] || instData.source;
  const canonicalUrl = `https://good.vibes.diy/edu/${instSlug}/`;
  const pageTitle = `${instName} Courses | Vibes DIY Edu`;
  const metaDesc = `${coursesWithMeta.length} courses from ${instName} — ${instData.location}. Browse syllabi and study tools.`;

  const courseRows = coursesWithMeta
    .map(({ course, courseSlug, clusters }) => {
      const topicsHtml = course.topics
        .slice(0, 6)
        .map((t) => `<span class="tag">${esc(t)}</span>`)
        .join(" ");
      const clusterHtml = clusters.length
        ? clusters
            .map(
              (c) =>
                `<a href="../${esc(c.slug)}.html" class="cluster-link">${esc(c.label)}</a>`,
            )
            .join(" ")
        : "";
      return `<a href="${esc(courseSlug)}.html" class="course-row">
      <div class="course-row-body">
        <div class="course-row-title">${esc(course.title)}</div>
        <div class="course-row-meta">${esc(course.department)} · ${esc(String(course.year))}</div>
        <div class="tags">${topicsHtml}</div>
        ${clusterHtml ? `<div class="cluster-links">${clusterHtml}</div>` : ""}
      </div>
      <span class="course-row-arrow">→</span>
    </a>`;
    })
    .join("\n");

  return `{{!--
{
  "layout": "webring",
  "title": "${pageTitle.replace(/"/g, '\\"')}",
  "description": "${metaDesc.replace(/"/g, '\\"')}",
  "ogUrl": "${canonicalUrl}"
}
--}}
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f0; color: #1a1a1a; font-size: 14px; line-height: 1.5; }
.topbar {
  position: sticky; top: 0; z-index: 100;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 1.25rem; background: #231F20; color: #FFFFF0;
  border-bottom: 2px solid #000; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
}
.topbar a { color: inherit; text-decoration: none; opacity: 0.7; }
.topbar a:hover { opacity: 1; }
.topbar .sep { opacity: 0.35; margin: 0 0.4rem; }
.topbar-logo { height: 22px; width: auto; opacity: 0.85; vertical-align: middle; margin-right: 0.5rem; }
.wrap { max-width: 860px; margin: 0 auto; padding: 2rem 1.25rem 5rem; }
.breadcrumb { font-size: 0.75rem; color: #888; margin-bottom: 1.5rem; }
.breadcrumb a { color: #0070c9; text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb .sep { opacity: 0.5; margin: 0 0.3rem; }
.inst-hero { margin-bottom: 1.75rem; }
.inst-hero h1 { font-size: 1.8rem; font-weight: 800; line-height: 1.15; margin-bottom: 0.25rem; }
.inst-hero p { font-size: 0.85rem; color: #666; }
.course-row {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
  background: white; border: 2px solid #231F20; border-radius: 8px;
  padding: 1.1rem 1.25rem; margin-bottom: 0.75rem;
  text-decoration: none; color: inherit;
  transition: background 0.1s, border-color 0.1s;
}
.course-row:hover { background: #FFFFF0; border-color: #0070c9; }
.course-row-body { flex: 1; min-width: 0; }
.course-row-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 0.2rem; line-height: 1.3; }
.course-row:hover .course-row-title { color: #0070c9; }
.course-row-meta { font-size: 0.72rem; color: #888; margin-bottom: 0.5rem; }
.course-row-arrow { font-size: 1.1rem; color: #ccc; flex-shrink: 0; margin-top: 0.1rem; transition: color 0.1s; }
.course-row:hover .course-row-arrow { color: #0070c9; }
.tags { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-bottom: 0.5rem; }
.tag { font-size: 0.67rem; padding: 0.12rem 0.4rem; background: rgba(35,31,32,0.06); border: 1px solid rgba(35,31,32,0.12); border-radius: 3px; color: #444; }
.cluster-links { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.cluster-link {
  display: inline-flex; align-items: center; gap: 0.2rem;
  font-size: 0.65rem; font-weight: 600; padding: 0.12rem 0.45rem;
  background: rgba(0,112,201,0.07); border: 1.5px solid #0070c9;
  color: #0070c9; border-radius: 3px; text-decoration: none;
  transition: background 0.1s, color 0.1s;
}
.cluster-link:hover { background: #0070c9; color: white; }
.cluster-link::after { content: " →"; font-size: 0.58rem; opacity: 0.7; }
.footer { text-align: center; padding: 2rem 1rem; font-size: 0.78rem; color: #999; border-top: 1px solid #ccc; margin-top: 2rem; }
.footer a { color: inherit; }
</style>

<nav class="topbar">
  <div>
    <a href="https://links.vibes.diy/homepage"><img src="{{assetPrefix}}Vibes-Toggle-1-Transparent.png" alt="Vibes DIY" class="topbar-logo"></a>
    <span class="sep">/</span>
    <a href="../syllabi.html">Edu Portal</a>
    <span class="sep">/</span>
    ${esc(instName)}
  </div>
  <div>${esc(String(coursesWithMeta.length))} courses</div>
</nav>

<div class="wrap">
  <div class="breadcrumb">
    <a href="../syllabi.html">Syllabi</a>
    <span class="sep">/</span>
    ${esc(instName)}
  </div>

  <div class="inst-hero">
    <h1>${esc(instName)}</h1>
    <p>${esc(instData.location)} · ${esc(String(coursesWithMeta.length))} courses</p>
  </div>

  ${courseRows}
</div>

<footer class="footer">
  <a href="https://links.vibes.diy/homepage">Vibes DIY</a> — build your own app from any topic in this corpus
</footer>
`;
}

// ── Also update cluster JSONs with app metadata ───────────────────────────
function syncClusterJsons(clusterAppsMap) {
  const CLUSTER_DIR = path.join(ROOT, "research", "clusters");
  let synced = 0;
  for (const [slug, { apps }] of Object.entries(clusterAppsMap)) {
    const jsonPath = path.join(CLUSTER_DIR, `${slug}.json`);
    if (!fs.existsSync(jsonPath)) continue;
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    // Replace app_prompts with deployed app metadata
    data.apps = apps.map(({ num, slug: appSlug, author, live, title, tagline }) => ({
      num,
      slug: appSlug,
      author,
      live,
      title,
      tagline,
    }));
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    synced++;
  }
  console.log(`Synced ${synced} cluster JSON(s) with deployed app metadata.`);
}

// ── Main ──────────────────────────────────────────────────────────────────
const clusterAppsMap = loadClusterApps();
console.log(`Loaded app data for ${Object.keys(clusterAppsMap).length} clusters.`);

const files = fs
  .readdirSync(HARVEST_DIR)
  .filter((f) => f.endsWith(".json") && f !== "README.md" && f !== "README.json");

let total = 0;
const generated = [];

for (const file of files) {
  const data = JSON.parse(
    fs.readFileSync(path.join(HARVEST_DIR, file), "utf-8"),
  );
  const instSlug = INST_SLUGS[data.source];
  if (!instSlug) {
    console.warn(`⚠  No slug mapping for "${data.source}" — skipping`);
    continue;
  }

  const outDir = path.join(EDU_DIR, instSlug);
  fs.mkdirSync(outDir, { recursive: true });

  // Collect course metadata for this institution
  const coursesWithMeta = data.items.map((course) => ({
    course,
    courseSlug: toSlug(course.title),
    clusters: findClusters(course.title),
  }));

  // Institution index page
  const indexContent = buildInstPage(data, instSlug, coursesWithMeta);
  fs.writeFileSync(path.join(outDir, "index.hbs"), indexContent);
  console.log(`  ✓ ${instSlug}/index  (${coursesWithMeta.length} courses)`);

  // Individual course pages
  for (const { course, courseSlug, clusters } of coursesWithMeta) {
    const content = buildPage(data, course, instSlug, courseSlug, clusters, clusterAppsMap);
    fs.writeFileSync(path.join(outDir, `${courseSlug}.hbs`), content);
    total++;
    const clusterLabels = clusters.map((c) => c.label).join(", ") || "—";
    generated.push({ url: `/edu/${instSlug}/${courseSlug}/`, instSlug, courseSlug, title: course.title, clusters: clusters.map((c) => c.slug) });
    console.log(`    • ${courseSlug}  [${clusterLabels}]`);
  }
}

console.log(`\nGenerated 8 institution pages + ${total} course pages.`);

// Sync cluster JSONs
syncClusterJsons(clusterAppsMap);

// Write manifest
const manifestPath = path.join(ROOT, "research", "course-page-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(generated, null, 2));
console.log(`Manifest → research/course-page-manifest.json`);
