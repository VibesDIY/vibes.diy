#!/usr/bin/env node
// Screenshot all pending photo creatives in photo-ab-work.json at 1200x630.
// Updates photoJpg paths in the work JSON after completion.

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const WORK_FILE = path.join(__dirname, "photo-ab-work.json");
const WORK = JSON.parse(fs.readFileSync(WORK_FILE, "utf8"));

const toShot = WORK.filter(
  (e) =>
    e.photoHtml &&
    e.status !== "done" &&
    e.status !== "skipped" &&
    e.status !== "screenshotted",
);

async function main() {
  if (toShot.length === 0) {
    console.log("Nothing to screenshot.");
    return;
  }
  console.log(`Screenshotting ${toShot.length} creatives...`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });

  for (const entry of toShot) {
    const src = path.resolve(entry.photoHtml);
    const out = path.resolve(entry.photoJpg);
    process.stdout.write(`  ${entry.slug}...`);
    try {
      await page.goto(`file://${src}`, {
        waitUntil: "networkidle2",
        timeout: 20000,
      });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: out,
        type: "jpeg",
        quality: 90,
        clip: { x: 0, y: 0, width: 1200, height: 630 },
      });
      const size = fs.statSync(out).size;
      if (size < 10000) throw new Error(`file too small: ${size} bytes`);
      entry.status = "screenshotted";
      console.log(` ${Math.round(size / 1024)}KB`);
    } catch (e) {
      console.log(` FAILED: ${e.message}`);
    }
  }

  await browser.close();
  fs.writeFileSync(WORK_FILE, JSON.stringify(WORK, null, 2));
  console.log("\nDone. photo-ab-work.json updated.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
