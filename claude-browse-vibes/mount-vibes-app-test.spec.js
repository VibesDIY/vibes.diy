import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";

test("MountVibesApp behavior test - mock_login + click switch", async ({
  page,
}) => {
  // Listen for console logs
  page.on("console", (msg) => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  console.log("🚀 Testing MountVibesApp behavior...");

  // Navigate to current vibe
  console.log("📖 Navigating to current vibe...");
  await page.goto("http://localhost:3456/vibe/cute-frog-9259_jchris");

  // Wait for page to load
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  console.log("📸 Taking initial screenshot...");
  await page.screenshot({
    path: test.info().outputPath("mount-vibes-app-initial.png"),
    fullPage: true,
  });

  // Check if we're on auth wall or logged in
  console.log("🔍 Checking page state...");

  // Look for auth wall title first
  const authTitle = page.locator("h1").first();
  await authTitle.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  const onAuthWall = await authTitle.isVisible();
  if (onAuthWall) {
    const titleText = await authTitle.textContent();
    console.log(`📋 Found auth wall with title: "${titleText}"`);

    // Assert body has a background image
    const backgroundImage = await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage,
    );
    console.log(`🖼️  Auth wall background: ${backgroundImage}`);
    expect(backgroundImage).not.toBe("none");
  } else {
    console.log("🔍 No auth wall found, looking for VibesSwitch button...");
  }

  // Look for VibesSwitch button if not on auth wall
  if (!onAuthWall) {
    const vibesButton = page.locator('button[aria-haspopup="dialog"]');
    await expect(vibesButton).toBeVisible({ timeout: 10000 });

    console.log("👆 Clicking VibesSwitch button...");
    await vibesButton.click();

    // Wait for menu to appear
    await page.waitForTimeout(1000);

    console.log("📸 Taking screenshot with menu open...");
    await page.screenshot({
      path: test.info().outputPath("mount-vibes-app-menu-open.png"),
      fullPage: true,
    });
  }

  // Save full HTML for inspection in test output dir
  console.log("📝 Capturing page HTML...");
  const html = await page.content();
  await fs.writeFile(
    test.info().outputPath("mount-vibes-app-innerHTML.html"),
    html,
    "utf8",
  );

  console.log("✅ Test completed successfully!");
  console.log("📁 Files saved:");
  console.log("   - mount-vibes-app-initial.png");
  console.log("   - mount-vibes-app-menu-open.png");
  console.log("   - mount-vibes-app-innerHTML.html (in downloads)");

  if (!onAuthWall) {
    // Verify menu is visible
    const menu = page.locator("#hidden-menu");
    await expect(menu).toBeVisible();
  }

  if (onAuthWall) {
    console.log(
      "ℹ️ On auth wall – verified background present; skipped menu assertions.",
    );
  } else {
    console.log("🎯 Assertions passed: VibesSwitch visible and menu visible.");
  }
});
