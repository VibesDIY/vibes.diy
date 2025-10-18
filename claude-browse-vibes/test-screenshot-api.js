import puppeteer from "puppeteer";

async function testScreenshotAPI() {
  console.log("🧪 Testing screenshot API integration...");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  try {
    // Test with hosted-dev environment first
    const devUrl = "http://localhost:5173";
    console.log(`📱 Loading dev app: ${devUrl}`);
    await page.goto(devUrl, { waitUntil: "networkidle2" });

    // Enable sync to trigger auth wall
    console.log("🔐 Triggering auth wall by enabling sync...");
    await page.click('button:has-text("Enable Sync")');

    // Wait for auth wall to appear
    await page.waitForSelector("h1", { timeout: 5000 });

    // Check if auth wall is visible
    const authWallTitle = await page.$eval("h1", (el) => el.textContent);
    console.log(`📋 Auth wall title: "${authWallTitle}"`);

    // Check the background image URL
    const wrapperElement = await page.$('div[style*="background-image"]');
    if (wrapperElement) {
      const style = await page.evaluate(
        (el) => el.style.cssText,
        wrapperElement,
      );
      console.log(`🖼️  Background style: ${style}`);

      // Extract image URL
      const imageUrlMatch = style.match(
        /background-image:\s*url\("?([^"]+)"?\)/,
      );
      if (imageUrlMatch) {
        const imageUrl = imageUrlMatch[1];
        console.log(`📸 Image URL: ${imageUrl}`);

        if (imageUrl.includes("/screenshot.png")) {
          console.log("✅ Using screenshot API as expected");

          // Test if screenshot endpoint responds
          try {
            const response = await page.goto(
              "http://localhost:5173/screenshot.png",
            );
            console.log(`📊 Screenshot endpoint status: ${response.status()}`);
            if (response.status() === 200) {
              console.log("✅ Screenshot API working");
            } else {
              console.log(
                "⚠️  Screenshot API returned non-200, browser should fallback",
              );
            }
          } catch (error) {
            console.log(
              "⚠️  Screenshot endpoint not available (expected for dev), browser will fallback",
            );
          }
        } else {
          console.log("❌ Not using screenshot API - still using old URL");
        }
      } else {
        console.log("❌ Could not extract image URL from style");
      }
    } else {
      console.log("❌ Could not find auth wall wrapper with background image");
    }

    // Check if the image loaded successfully or fell back
    const actualImage = await page.$('div[style*="background-image"] img');
    if (actualImage) {
      const naturalWidth = await page.evaluate(
        (img) => img.naturalWidth,
        actualImage,
      );
      console.log(`📐 Image dimensions: ${naturalWidth}px width`);

      if (naturalWidth > 0) {
        console.log("✅ Background image loaded successfully");
      } else {
        console.log("❌ Background image failed to load");
      }
    }

    console.log("🎯 Test completed - check visual result");

    // Keep browser open for manual inspection
    await new Promise((resolve) => {
      console.log("Press Enter to close browser...");
      process.stdin.once("data", resolve);
    });
  } catch (error) {
    console.error("💥 Test failed:", error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testScreenshotAPI().catch(console.error);
