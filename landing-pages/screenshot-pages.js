#!/usr/bin/env node
// Takes 1200x630 OG screenshots of topic pages from the local _site/ build.
// Usage:
//   node screenshot-pages.js          — only pages whose .hbs changed since last run
//   node screenshot-pages.js --all    — force all pages
// Output: images/screenshots/<slug>.jpg
// State: images/screenshots/.last-git-hash (written after each successful run)

const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SITE_DIR = path.join(__dirname, "_site");
const OUT_DIR = path.join(__dirname, "images", "screenshots");
const HASH_FILE = path.join(OUT_DIR, ".last-git-hash");
const PORT = 8765;
const WIDTH = 1200;
const HEIGHT = 630;

const SLUGS = [
  "access-api",
  "accountability",
  "babylon-3d",
  "bike-summer",
  "builders",
  "chess",
  "coaches",
  "college",
  "connect-backend-data",
  "zine",
  "free-library",
  "group-chat",
  "contractors",
  "creator-documentation",
  "creators",
  "growth-writers",
  "dating",
  "electric-psych-rock",
  "engineers",
  "fantasy-league",
  "garage-sale",
  "fashion-photographers",
  "food-trucks",
  "generate",
  "golf-league",
  "homeschoolers",
  "hotwheels",
  "how-to",
  "music-studio",
  "newsletter",
  "organizers",
  "psu-hackathon",
  "puppies",
  "reshippers",
  "shared-rituals",
  "sharing",
  "science-kits",
  "teachers",
  "trivia",
  "trivia-night",
  "valentines",
  "vibes-connect",
  "volunteer-coordinators",
  "wedding",
  "wishlist",
  "would-you-rather",
  "world-cup-pool",
  "youtubers",
  "summer-camp",
  "group-ranker",
  "church-summer",
  "pta-pto",
  "block-party",
  "tailgate",
  "rec-league",
  "road-trip",
  "camping",
  "carnival",
  "game-maker",
  "crew/chaos",
  "crew/the-list",
  "crew/the-bit",
  "the-booth",
  "save-the-date",
  "edu/study/flashcards",
  "edu/study/quizzes",
  "edu/syllabi",
  "edu/slavery-civil-rights",
  "edu/us-foreign-policy",
  "edu/urban-race-housing",
  "edu/latin-american-history",
  "edu/ethics-philosophy",
  "edu/revolutions-political-change",
  "edu/capitalism-labor-history",
  "edu/gender-colonialism",
  "edu/music-sound-culture",
  "edu/index",
  "edu/about",
  "edu/algorithmic-creative-writing",
  "edu/behavioral-economics",
  "edu/causal-inference",
  "edu/climate-change-policy",
  "edu/epidemiology-study-design",
  "edu/machine-learning-methods",
  "edu/policy-analysis-decision-modeling",
  "edu/research-methods-regression",
  "edu/spatial-analysis-gis",
  "edu/urban-land-use-planning",
  "featured-apps/image-generation",
  "philosophy",
  "relationships",
  "about",
  "expressions/nahui-ollin",
  "bridesmaids",
  "hamburger-business-review",
  "rip-city",
];

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function slugToSource(slug) {
  return `src/pages/${slug}.hbs`;
}

function changedSlugs(storedHash) {
  try {
    const out = execSync(`git diff --name-only ${storedHash}`, {
      encoding: "utf8",
      cwd: __dirname,
    });
    const changed = new Set(out.trim().split("\n").filter(Boolean));
    return SLUGS.filter((s) => changed.has(slugToSource(s)));
  } catch {
    return SLUGS;
  }
}

function currentHash() {
  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf8",
      cwd: __dirname,
    }).trim();
  } catch {
    return null;
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    let filePath = path.join(
      SITE_DIR,
      req.url === "/" ? "/index.html" : req.url,
    );
    if (!path.extname(filePath)) filePath += ".html";
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const forceAll = process.argv.includes("--all");
  const namedSlug = process.argv.find(
    (a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1],
  );
  let slugsToRun = SLUGS;

  if (namedSlug) {
    if (!SLUGS.includes(namedSlug)) {
      console.log(`Unknown slug "${namedSlug}". Add it to SLUGS first.`);
      return;
    }
    slugsToRun = [namedSlug];
    console.log(`Screenshotting single page: ${namedSlug}`);
  } else if (!forceAll && fs.existsSync(HASH_FILE)) {
    const storedHash = fs.readFileSync(HASH_FILE, "utf8").trim();
    slugsToRun = changedSlugs(storedHash);
    if (slugsToRun.length === 0) {
      console.log(
        "No .hbs changes since last run. Pass --all to force all pages.",
      );
      return;
    }
    console.log(
      `Screenshotting ${slugsToRun.length} changed page(s) (since ${storedHash.slice(0, 8)}):`,
    );
    slugsToRun.forEach((s) => console.log(`  ${s}`));
  } else {
    console.log(`Screenshotting all ${slugsToRun.length} pages...`);
  }

  console.log("Starting local server...");
  const server = await startServer();

  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });

  for (const slug of slugsToRun) {
    const url = `http://localhost:${PORT}/${slug}.html`;
    const outFile = path.join(OUT_DIR, `${slug}.jpg`);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    process.stdout.write(`  ${slug}...`);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: outFile,
        type: "jpeg",
        quality: 90,
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      });
      console.log(" done");
    } catch (e) {
      console.log(` FAILED: ${e.message}`);
    }
  }

  await browser.close();
  server.close();
  console.log(`\nScreenshots saved to images/screenshots/`);

  const hash = currentHash();
  if (hash) {
    fs.writeFileSync(HASH_FILE, hash + "\n");
    console.log(`Last-run hash recorded: ${hash.slice(0, 8)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
