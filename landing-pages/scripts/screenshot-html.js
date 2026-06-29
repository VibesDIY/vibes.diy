#!/usr/bin/env node
// Screenshot any HTML file or URL at 1200x630 for ad creatives.
// Usage: node scripts/screenshot-html.js <html-file-or-http-url> <output.jpg>

const puppeteer = require("puppeteer");
const path = require("path");

async function main() {
  const [, , src, out] = process.argv;
  if (!src || !out) {
    console.error(
      "Usage: node scripts/screenshot-html.js <html-file-or-url> <output.jpg>",
    );
    process.exit(1);
  }
  const url = src.startsWith("http") ? src : `file://${path.resolve(src)}`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: out,
    type: "jpeg",
    quality: 90,
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  await browser.close();
  console.log(`Saved: ${out}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
