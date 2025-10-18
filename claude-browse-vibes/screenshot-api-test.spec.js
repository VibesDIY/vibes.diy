import { test, expect } from "@playwright/test";

test("Screenshot API integration test", async ({ page }) => {
  // Listen for console logs
  page.on("console", (msg) => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  console.log("🧪 Testing screenshot API integration...");

  // Navigate to current running vibe
  console.log("📱 Loading current vibe...");
  await page.goto("http://localhost:3456/vibe/cute-frog-9259_jchris");
  await page.waitForLoadState("networkidle");

  // Wait for auth wall to appear (should already be visible)
  console.log("⏳ Waiting for auth wall to appear...");
  await page.waitForSelector("h1", { timeout: 10000 });

  // Check if auth wall is visible
  const authWallTitle = await page.locator("h1").textContent();
  console.log(`📋 Auth wall title: "${authWallTitle}"`);

  // Read the computed background on the body (less brittle than selecting a div)
  await page.waitForTimeout(500);
  const backgroundImage = await page.evaluate(
    () => getComputedStyle(document.body).backgroundImage,
  );
  console.log(`🖼️  Background image: ${backgroundImage}`);
  expect(backgroundImage).not.toBe("none");
  // Expect either screenshot.png (preferred) or a known fallback
  expect(backgroundImage).toMatch(/screenshot\.png|unsplash/);

  // Test if screenshot endpoint exists
  console.log("🔍 Testing screenshot endpoint...");
  const resp = await page.request.get(
    "http://localhost:3456/vibe/cute-frog-9259_jchris/screenshot.png",
  );
  console.log(`📊 Screenshot endpoint status: ${resp.status()}`);
  if (process.env.ALLOW_SCREENSHOT_404 === "1") {
    expect([200, 404]).toContain(resp.status());
  } else {
    expect(resp.status()).toBe(200);
  }

  // Take a screenshot for visual verification
  console.log("📸 Taking screenshot for visual verification...");
  await page.screenshot({
    path: test.info().outputPath("screenshot-api-test.png"),
    fullPage: true,
  });

  console.log(
    "✅ Test completed - screenshot saved as screenshot-api-test.png",
  );
});
