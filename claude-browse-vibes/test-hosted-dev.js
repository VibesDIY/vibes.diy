// Test script for hosted-dev example
// This script checks for vibes control elements and logs

import { chromium } from "playwright";

async function testHostedDev() {
  console.log("🔍 Testing hosted-dev example...");

  const browser = await chromium.launch({
    headless: false, // Keep visible to see what's happening
    devtools: true, // Open devtools to see logs
  });

  const page = await browser.newPage();

  // Listen to console logs from the page
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();

    // Highlight vibes-related logs
    if (
      text.includes("vibes") ||
      text.includes("mount") ||
      text.includes("Vibes")
    ) {
      console.log(`🎛️ [${type.toUpperCase()}] ${text}`);
    } else {
      console.log(`📋 [${type.toUpperCase()}] ${text}`);
    }
  });

  // Listen to errors
  page.on("pageerror", (error) => {
    console.error("❌ Page Error:", error.message);
  });

  try {
    console.log("🌐 Navigating to hosted-dev example...");
    await page.goto("http://localhost:3456", {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // Wait for React to mount
    await page.waitForTimeout(2000);

    console.log("🔍 Checking for vibes control elements...");

    // Check for the vibe-control container
    const vibeControl = await page.locator("#vibe-control");
    const vibeControlExists = (await vibeControl.count()) > 0;
    console.log(`📦 #vibe-control exists: ${vibeControlExists}`);

    if (vibeControlExists) {
      const vibeControlContent = await vibeControl
        .innerHTML()
        .catch(() => "Could not read innerHTML");
      console.log(
        `📝 #vibe-control content length: ${vibeControlContent.length} characters`,
      );
    }

    // Look for Login and Invite buttons in the entire page
    console.log("🔍 Searching for Login and Invite buttons...");

    const loginButtons = await page.locator("text=Login").all();
    console.log(`🔑 Found ${loginButtons.length} "Login" elements`);

    for (let i = 0; i < loginButtons.length; i++) {
      const button = loginButtons[i];
      const isVisible = await button.isVisible();
      const text = await button.textContent();
      console.log(`  Login ${i + 1}: "${text}" (visible: ${isVisible})`);
    }

    const inviteButtons = await page.locator("text=Invite").all();
    console.log(`📮 Found ${inviteButtons.length} "Invite" elements`);

    for (let i = 0; i < inviteButtons.length; i++) {
      const button = inviteButtons[i];
      const isVisible = await button.isVisible();
      const text = await button.textContent();
      console.log(`  Invite ${i + 1}: "${text}" (visible: ${isVisible})`);
    }

    // Look for Remix buttons (should show our emoji and "Remixmaster")
    const remixButtons = await page
      .locator("text=/.*Remix.*/", { hasText: /Remix/ })
      .all();
    console.log(`💽 Found ${remixButtons.length} "Remix" elements`);

    for (let i = 0; i < remixButtons.length; i++) {
      const button = remixButtons[i];
      const isVisible = await button.isVisible();
      const text = await button.textContent();
      console.log(`  Remix ${i + 1}: "${text}" (visible: ${isVisible})`);
    }

    // Also search for "Remixmaster" specifically
    const remixmasterButtons = await page.locator("text=Remixmaster").all();
    console.log(`🎯 Found ${remixmasterButtons.length} "Remixmaster" elements`);

    for (let i = 0; i < remixmasterButtons.length; i++) {
      const button = remixmasterButtons[i];
      const isVisible = await button.isVisible();
      const text = await button.textContent();
      console.log(`  Remixmaster ${i + 1}: "${text}" (visible: ${isVisible})`);
    }

    // Try clicking "Enable Sync" to trigger auth wall
    console.log("🔄 Trying to trigger auth wall...");

    const enableSyncButton = await page.locator("text=Enable Sync").first();
    if ((await enableSyncButton.count()) > 0) {
      console.log('🎯 Found "Enable Sync" button, clicking...');
      await enableSyncButton.click();

      // Wait for auth wall to appear
      await page.waitForTimeout(2000);

      // Check for auth wall elements
      const authWallLogin = await page.locator("text=Login").all();
      console.log(
        `🔐 After enabling sync, found ${authWallLogin.length} "Login" elements`,
      );

      // Check if any are now visible
      for (let i = 0; i < authWallLogin.length; i++) {
        const button = authWallLogin[i];
        const isVisible = await button.isVisible();
        const text = await button.textContent();
        console.log(`  Auth Login ${i + 1}: "${text}" (visible: ${isVisible})`);
      }

      // Also check if Remixmaster appeared after enabling sync
      const postSyncRemixmaster = await page.locator("text=Remixmaster").all();
      console.log(
        `🎯 After enabling sync, found ${postSyncRemixmaster.length} "Remixmaster" elements`,
      );

      for (let i = 0; i < postSyncRemixmaster.length; i++) {
        const button = postSyncRemixmaster[i];
        const isVisible = await button.isVisible();
        const text = await button.textContent();
        console.log(
          `  Post-sync Remixmaster ${i + 1}: "${text}" (visible: ${isVisible})`,
        );
      }
    } else {
      console.log('⚠️ "Enable Sync" button not found');
    }

    // Take a screenshot for debugging
    await page.screenshot({
      path: "/Users/jchris/code/vibes.diy/claude-browse-vibes/hosted-dev-test.png",
      fullPage: true,
    });
    console.log("📸 Screenshot saved to hosted-dev-test.png");

    // Keep browser open for manual inspection
    console.log(
      "🔍 Browser left open for manual inspection. Press Ctrl+C to close.",
    );
    await new Promise((resolve) => {
      process.on("SIGINT", resolve);
    });
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    await browser.close();
  }
}

// Run the test
testHostedDev().catch(console.error);
