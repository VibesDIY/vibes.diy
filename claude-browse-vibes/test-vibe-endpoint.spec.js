import { test, expect } from "@playwright/test";

test("Load vibe endpoint and check console logs", async ({ page }) => {
  const vibeUrl = "http://localhost:8001/vibe/atmospheric-tiger-9377";

  // Collect console messages
  const consoleLogs = [];
  const consoleErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();

    if (type === "error") {
      consoleErrors.push(text);
      console.log(`❌ CONSOLE ERROR: ${text}`);
    } else {
      consoleLogs.push(text);
      console.log(`📋 CONSOLE ${type.toUpperCase()}: ${text}`);
    }
  });

  // Collect page errors
  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
    console.log(`🔴 PAGE ERROR: ${error.message}`);
  });

  // Navigate to vibe endpoint
  console.log(`\n🚀 Loading: ${vibeUrl}\n`);

  const response = await page.goto(vibeUrl, {
    waitUntil: "networkidle",
    timeout: 10000,
  });

  console.log(`\n📊 Response Status: ${response.status()}\n`);

  // Wait a bit for any async loading
  await page.waitForTimeout(2000);

  // Check page content
  const title = await page.title();
  const bodyText = await page.textContent("body");

  console.log(`\n📄 Page Title: ${title}`);
  console.log(`\n📝 Body Content (first 200 chars):`);
  console.log(bodyText?.slice(0, 200));

  // Check for div#vibes.diy
  const vibeDiv = await page.$("#vibes\\.diy");
  console.log(`\n🎯 Found #vibes.diy div: ${vibeDiv !== null}`);

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Console Logs: ${consoleLogs.length}`);
  console.log(`   Console Errors: ${consoleErrors.length}`);
  console.log(`   Page Errors: ${pageErrors.length}`);

  if (consoleErrors.length > 0) {
    console.log(`\n❌ Console Errors Found:`);
    consoleErrors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err}`);
    });
  }

  if (pageErrors.length > 0) {
    console.log(`\n🔴 Page Errors Found:`);
    pageErrors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err}`);
    });
  }

  // Assertions
  expect(response.status()).toBe(200);
  expect(title).toContain("atmospheric-tiger-9377");
  expect(vibeDiv).not.toBeNull();

  // Optionally fail if there are errors (comment out if you want to see errors without failing)
  // expect(consoleErrors.length).toBe(0);
  // expect(pageErrors.length).toBe(0);
});
