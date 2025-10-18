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

  // Check the background image URL in the wrapper element
  const wrapperElement = page.locator("div").first();

  // Wait a bit for styles to load
  await page.waitForTimeout(1000);

  // Get computed styles
  const backgroundImage = await wrapperElement.evaluate((el) => {
    return window.getComputedStyle(el).backgroundImage;
  });

  console.log(`🖼️  Background image: ${backgroundImage}`);

  // Check if it uses screenshot API
  if (backgroundImage.includes("/screenshot.png")) {
    console.log("✅ Using screenshot API as expected");
  } else if (backgroundImage.includes("unsplash")) {
    console.log(
      "❌ Still using old Unsplash image - screenshot API not working",
    );
  } else {
    console.log("⚠️  Different background image detected");
  }

  // Test if screenshot endpoint exists
  console.log("🔍 Testing screenshot endpoint...");
  try {
    const response = await page.request.get(
      "http://localhost:3456/vibe/cute-frog-9259_jchris/screenshot.png",
    );
    console.log(`📊 Screenshot endpoint status: ${response.status()}`);
    if (response.status() === 200) {
      console.log("✅ Screenshot API working");
    } else {
      console.log("⚠️  Screenshot API returned non-200");
    }
  } catch (error) {
    console.log("⚠️  Screenshot endpoint error:", error.message);
  }

  // Take a screenshot for visual verification
  console.log("📸 Taking screenshot for visual verification...");
  await page.screenshot({
    path: "/Users/jchris/code/vibes.diy/claude-browse-vibes/screenshot-api-test.png",
    fullPage: true,
  });

  console.log(
    "✅ Test completed - screenshot saved as screenshot-api-test.png",
  );
});
