import { test, expect } from "@playwright/test";

test("VibeControl correct behavior test - mock_login + click switch", async ({ page }) => {
  // Listen for console logs
  page.on("console", (msg) => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  console.log("🚀 Testing VibeControl correct behavior...");

  // Navigate to vibe-control with mock_login (use React example server)
  console.log("📖 Navigating to vibe-control with mock_login=true...");
  await page.goto("http://localhost:5173/vibe-control?mock_login=true");

  // Wait for page to load
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  console.log("📸 Taking initial screenshot...");
  await page.screenshot({ path: "vibe-control-correct-initial.png", fullPage: true });

  // Wait for VibesSwitch button
  console.log("🔍 Looking for VibesSwitch button...");
  const vibesButton = page.locator('button[aria-haspopup="dialog"]');
  await expect(vibesButton).toBeVisible({ timeout: 10000 });

  console.log("👆 Clicking VibesSwitch button...");
  await vibesButton.click();

  // Wait for menu to appear
  await page.waitForTimeout(1000);

  console.log("📸 Taking screenshot with menu open...");
  await page.screenshot({ path: "vibe-control-correct-menu-open.png", fullPage: true });

  // Capture innerHTML
  console.log("📝 Capturing innerHTML...");
  const innerHTML = await page.evaluate(() => document.body.innerHTML);
  
  // Write to file
  await page.evaluate((content) => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vibe-control-correct-innerHTML.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, innerHTML);

  console.log("✅ Test completed successfully!");
  console.log("📁 Files saved:");
  console.log("   - vibe-control-correct-initial.png");
  console.log("   - vibe-control-correct-menu-open.png");
  console.log("   - vibe-control-correct-innerHTML.html (in downloads)");

  // Verify menu is visible
  const menu = page.locator('#hidden-menu');
  await expect(menu).toBeVisible();

  // Verify buttons are present
  const loginButton = page.getByRole('button', { name: 'Login' });
  const remixButton = page.getByRole('button', { name: 'Remix' });  
  const inviteButton = page.getByRole('button', { name: 'Invite' });
  
  await expect(loginButton).toBeVisible();
  await expect(remixButton).toBeVisible();
  await expect(inviteButton).toBeVisible();

  console.log("🎯 All assertions passed - correct behavior confirmed!");
});