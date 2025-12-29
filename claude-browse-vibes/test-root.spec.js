import { test, expect } from "@playwright/test";

test("Load root endpoint and check console logs", async ({ page }) => {
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

  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
    console.log(`🔴 PAGE ERROR: ${error.message}`);
  });

  console.log("\n🚀 Loading: http://localhost:8001/\n");

  const response = await page.goto("http://localhost:8001/", {
    waitUntil: "networkidle",
    timeout: 10000,
  });

  console.log(`\n📊 Response Status: ${response.status()}\n`);

  await page.waitForTimeout(5000);

  const title = await page.title();
  const bodyText = await page.textContent("body");

  console.log(`\n📄 Page Title: ${title}`);
  console.log(`\n📝 Body Content (first 200 chars):`);
  console.log(bodyText?.slice(0, 200));

  const vibeDiv = await page.$("#vibes\\.diy");
  console.log(`\n🎯 Found #vibes.diy div: ${vibeDiv !== null}`);

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

  expect(response.status()).toBe(200);
  expect(title).toBe("Vibes DIY");
  expect(vibeDiv).not.toBeNull();
});
