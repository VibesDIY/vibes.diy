#!/usr/bin/env node
// Generate a branded "title card" illustration for a blog post — a duotone
// (teal -> goldenrod) treatment of an Unsplash photo with the post's glyph,
// overline, and title set over it. Use this when a post has no real
// screenshot, so its index card and feed image aren't a bare text tile.
//
// Usage:
//   node scripts/blog-card.js \
//     --slug retiring-isowner \
//     --photo photo-1582139329536-e7284fece509 \
//     --overline "Access control" \
//     --glyph "isOwner ✗" \
//     --title "The vibe that locked out its owner"
//
//   # --photo accepts an Unsplash photo id (photo-…), a full https URL, or a
//   # local file path. Output lands at images/blog/<slug>/card.jpg (1600x900).
//
// Then in the post's front-matter set:  thumb: "/images/blog/<slug>/card.jpg"
// and embed the same image in the body with a <figure> (see
// agents/blog-authoring.md § "No screenshot? Generate a title card").

const puppeteer = require("puppeteer");
const fs = require("node:fs");
const path = require("node:path");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// Cloud sessions skip puppeteer's own Chrome download but ship a Playwright
// Chromium under PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers). Fall back to it.
function resolveChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH)
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = fs
      .readdirSync(root)
      .filter((d) => d.startsWith("chromium-"))
      .sort()
      .pop();
    if (dir) {
      const exe = path.join(root, dir, "chrome-linux", "chrome");
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    /* not a cloud session — let puppeteer use its bundled Chrome */
  }
  return undefined;
}

async function loadPhotoB64(photo) {
  // Local file
  if (!photo.startsWith("http") && !photo.startsWith("photo-")) {
    return fs.readFileSync(path.resolve(photo)).toString("base64");
  }
  const url = photo.startsWith("http")
    ? photo
    : `https://images.unsplash.com/${photo}?w=1600&q=80&fit=crop`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo fetch failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

// Escape HTML-significant chars so a title/overline/glyph containing `<`, `>`,
// `&`, or quotes (e.g. a code-style glyph like `<App/>`) renders as literal
// text instead of being parsed as markup by setContent.
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function html(bgB64, overlineRaw, glyphRaw, titleRaw) {
  const overline = esc(overlineRaw);
  const glyph = esc(glyphRaw);
  const title = esc(titleRaw);
  const len = glyphRaw.length;
  const glyphSize = len > 16 ? 92 : len > 11 ? 116 : 150;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@import url('https://fonts.cdnfonts.com/css/alte-haas-grotesk');
:root{--goldenrod:#FEDD00;--ivory:#FFFFF0;--black:#231F20;--teal:#0b3a4a;--bluey:#009ACE;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:1600px;height:900px;}
.card{position:relative;width:1600px;height:900px;overflow:hidden;background:var(--black);
  font-family:'Alte Haas Grotesk',sans-serif;}
.photo{position:absolute;inset:0;background-image:url('data:image/jpeg;base64,${bgB64}');
  background-size:cover;background-position:center;
  filter:grayscale(100%) contrast(118%) brightness(72%);}
.duo{position:absolute;inset:0;background:linear-gradient(135deg,rgba(11,58,74,0.80) 0%,rgba(35,31,32,0.93) 100%);}
.glow{position:absolute;inset:0;background:radial-gradient(120% 90% at 82% 12%,rgba(254,221,0,0.22) 0%,transparent 55%);}
.scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px);opacity:0.5;}
.wordmark{position:absolute;top:54px;left:50%;transform:translateX(-50%);
  font-family:'SFMono-Regular','Menlo','Consolas',monospace;font-size:24px;letter-spacing:0.42em;
  color:var(--ivory);opacity:0.85;text-transform:uppercase;}
.stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;padding:0 140px;}
.overline{font-family:'SFMono-Regular','Menlo','Consolas',monospace;font-size:27px;
  letter-spacing:0.34em;text-transform:uppercase;color:var(--bluey);margin-bottom:30px;
  text-shadow:0 2px 14px rgba(0,0,0,0.6);}
.glyph{font-family:'SFMono-Regular','Menlo','Consolas',monospace;font-weight:700;
  font-size:${glyphSize}px;line-height:1.06;letter-spacing:0.02em;color:var(--goldenrod);
  text-shadow:0 6px 34px rgba(0,0,0,0.7);max-width:1320px;}
.title{margin-top:46px;font-weight:700;font-size:44px;line-height:1.12;color:var(--ivory);
  letter-spacing:-0.01em;max-width:1120px;text-shadow:0 3px 22px rgba(0,0,0,0.75);}
.rule{margin-top:34px;width:96px;height:6px;background:var(--goldenrod);border-radius:3px;}
.edge{position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(254,221,0,0.18);}
</style></head><body>
<div class="card">
  <div class="photo"></div><div class="duo"></div><div class="glow"></div><div class="scan"></div>
  <div class="wordmark">Vibes&middot;DIY</div>
  <div class="stack">
    <div class="overline">${overline}</div>
    <div class="glyph">${glyph}</div>
    <div class="rule"></div>
    <div class="title">${title}</div>
  </div>
  <div class="edge"></div>
</div></body></html>`;
}

async function main() {
  const slug = arg("slug");
  const photo = arg("photo");
  const glyph = arg("glyph");
  const overline = arg("overline", "Vibes DIY");
  const title = arg("title", "");
  if (!slug || !photo || !glyph) {
    console.error(
      "Usage: node scripts/blog-card.js --slug <slug> --photo <unsplash-id|url|file> --glyph <text> [--overline <text>] [--title <text>]",
    );
    process.exit(1);
  }

  const bgB64 = await loadPhotoB64(photo);
  const outDir = path.resolve(__dirname, "..", "images", "blog", slug);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "card.jpg");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: resolveChrome(),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await page.setContent(html(bgB64, overline, glyph, title), {
    waitUntil: "networkidle0",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: out,
    type: "jpeg",
    quality: 82,
    clip: { x: 0, y: 0, width: 1600, height: 900 },
  });
  await browser.close();
  console.log(`Saved: images/blog/${slug}/card.jpg`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
