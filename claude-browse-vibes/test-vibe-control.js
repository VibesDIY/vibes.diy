import puppeteer from "puppeteer";
import fs from "fs";

async function testVibeControl() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1200, height: 800 },
  });

  const page = await browser.newPage();

  try {
    console.log("Navigating to vibe-control with mock_login...");
    await page.goto("http://localhost:5173/vibe-control?mock_login=true", {
      waitUntil: "networkidle2",
    });

    // Wait a moment for everything to load
    await page.waitForTimeout(2000);

    console.log("Taking initial screenshot...");
    await page.screenshot({ path: "vibe-control-initial.png", fullPage: true });

    console.log("Looking for VibesSwitch button...");
    // Wait for the VibesSwitch button to be visible
    await page.waitForSelector('button[aria-haspopup="dialog"]', {
      timeout: 10000,
    });

    console.log("Clicking VibesSwitch button...");
    await page.click('button[aria-haspopup="dialog"]');

    // Wait for menu to open
    await page.waitForTimeout(1000);

    console.log("Taking screenshot after menu open...");
    await page.screenshot({
      path: "vibe-control-menu-open.png",
      fullPage: true,
    });

    console.log("Capturing innerHTML...");
    const innerHTML = await page.evaluate(() => document.body.innerHTML);

    // Save innerHTML to file
    fs.writeFileSync("vibe-control-innerHTML.html", innerHTML);

    console.log("✅ Test completed successfully!");
    console.log("Files saved:");
    console.log("- vibe-control-initial.png (before click)");
    console.log("- vibe-control-menu-open.png (after click)");
    console.log("- vibe-control-innerHTML.html (DOM state)");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    await page.screenshot({ path: "vibe-control-error.png" });
    console.log("Error screenshot saved: vibe-control-error.png");
  } finally {
    await browser.close();
  }
}

testVibeControl();
