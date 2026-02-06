import { test, expect } from "@playwright/test";

test("ImgGenDisplay debug - check for images and file object logs", async ({ page }) => {
  // Listen for console logs to capture ImgGen debug output
  page.on("console", (msg) => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  console.log("🚀 Starting ImgGenDisplay debug test...");

  // Navigate to the React example app
  console.log("📖 Navigating to localhost:5173...");
  await page.goto("http://localhost:5173");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Take initial screenshot
  await page.screenshot({ path: "imggen-display-debug-start.png" });

  console.log("🔍 Checking for existing generated images...");

  // Check for img elements initially
  let images = page.locator("img");
  let imageCount = await images.count();
  console.log(`Found ${imageCount} img elements on page initially`);

  // If no images exist, generate one first
  if (imageCount === 0) {
    console.log("📝 No existing images found. Generating one first...");

    // Fill prompt input
    const promptInput = page.locator('input[placeholder*="prompt"]').first();
    if ((await promptInput.count()) > 0) {
      await promptInput.fill("simple test image");

      // Find and click generate button
      const generateButton = page.locator('button:has-text("Generate Image")').first();
      if ((await generateButton.count()) > 0) {
        console.log("🔄 Clicking generate button...");
        await generateButton.click();

        // Wait for generation to complete (up to 30 seconds)
        console.log("⏱️  Waiting up to 30 seconds for image generation...");
        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(1000);
          images = page.locator("img");
          imageCount = await images.count();
          if (imageCount > 0) {
            console.log(`✅ Found ${imageCount} images after ${i + 1} seconds!`);
            break;
          }
        }
      }
    }
  }

  // Now check for images again
  images = page.locator("img");
  imageCount = await images.count();
  console.log(`Final image count: ${imageCount}`);

  // Check for broken images (ones with alt text but no valid src)
  for (let i = 0; i < imageCount; i++) {
    const img = images.nth(i);
    const src = await img.getAttribute("src");
    const alt = await img.getAttribute("alt");
    const naturalWidth = await img.evaluate((el) => el.naturalWidth);
    const naturalHeight = await img.evaluate((el) => el.naturalHeight);

    console.log(`Image ${i}: src="${src}" alt="${alt}" naturalWidth=${naturalWidth} naturalHeight=${naturalHeight}`);

    if (naturalWidth === 0 && naturalHeight === 0) {
      console.log(`  ❌ Image ${i} appears to be broken (no natural dimensions)`);
    } else {
      console.log(`  ✅ Image ${i} appears to have loaded successfully`);
    }
  }

  console.log("⏱️  Monitoring console logs for 10 more seconds to capture file object debugging...");

  // Wait 10 seconds to capture any lazy-loaded images and console logs
  await page.waitForTimeout(10000);

  console.log("✅ Debug test completed!");

  // Take final screenshot
  await page.screenshot({ path: "imggen-display-debug-final.png" });
});
