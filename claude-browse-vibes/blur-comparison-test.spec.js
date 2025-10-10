import { test, expect } from "@playwright/test";

test("Blur comparison: vibe-control vs mount-vibes-app", async ({ page }) => {
  console.log(
    "🔍 Testing blur behavior differences between implementations...",
  );

  // Test vibe-control (correct behavior)
  console.log("📖 Testing vibe-control implementation...");
  await page.goto("http://localhost:5173/vibe-control?mock_login=true");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  console.log("👆 Clicking vibe-control switch...");
  const vibeControlButton = page.locator('button[aria-haspopup="dialog"]');
  await expect(vibeControlButton).toBeVisible({ timeout: 10000 });
  await vibeControlButton.click();
  await page.waitForTimeout(1000);

  // Check computed styles on menu elements in vibe-control
  console.log("🔍 Checking vibe-control menu blur styles...");
  const vibeControlMenu = page.locator("#hidden-menu");
  await expect(vibeControlMenu).toBeVisible();

  const vibeControlMenuStyle = await vibeControlMenu.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      filter: computed.filter,
      transform: computed.transform,
      zIndex: computed.zIndex,
    };
  });

  const vibeControlLoginButton = page.getByRole("button", { name: "Login" });
  const vibeControlLoginStyle = await vibeControlLoginButton.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      filter: computed.filter,
      opacity: computed.opacity,
    };
  });

  console.log("📊 Vibe-control styles:", {
    menu: vibeControlMenuStyle,
    loginButton: vibeControlLoginStyle,
  });

  console.log("📸 Taking vibe-control screenshot with zoom...");
  await page.screenshot({
    path: "vibe-control-blur-test.png",
    fullPage: true,
    clip: { x: 0, y: 400, width: 800, height: 400 }, // Focus on bottom area where menu appears
  });

  // Test mount-vibes-app (problematic behavior)
  console.log("📖 Testing mount-vibes-app implementation...");
  await page.goto("http://localhost:5173/mount-vibes-app?mock_login=true");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  console.log("👆 Clicking mount-vibes-app switch...");
  const mountVibesButton = page.locator('button[aria-haspopup="dialog"]');
  await expect(mountVibesButton).toBeVisible({ timeout: 10000 });
  await mountVibesButton.click();
  await page.waitForTimeout(1000);

  // Check computed styles on menu elements in mount-vibes-app
  console.log("🔍 Checking mount-vibes-app menu blur styles...");
  const mountVibesMenu = page.locator("#hidden-menu");
  await expect(mountVibesMenu).toBeVisible();

  const mountVibesMenuStyle = await mountVibesMenu.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      filter: computed.filter,
      transform: computed.transform,
      zIndex: computed.zIndex,
    };
  });

  const mountVibesLoginButton = page.getByRole("button", { name: "Login" });
  const mountVibesLoginStyle = await mountVibesLoginButton.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      filter: computed.filter,
      opacity: computed.opacity,
    };
  });

  console.log("📊 Mount-vibes-app styles:", {
    menu: mountVibesMenuStyle,
    loginButton: mountVibesLoginStyle,
  });

  console.log("📸 Taking mount-vibes-app screenshot with zoom...");
  await page.screenshot({
    path: "mount-vibes-app-blur-test.png",
    fullPage: true,
    clip: { x: 0, y: 400, width: 800, height: 400 }, // Focus on bottom area where menu appears
  });

  // Compare the blur values
  console.log("🔬 BLUR ANALYSIS:");
  console.log("✅ Vibe-control menu filter:", vibeControlMenuStyle.filter);
  console.log("❌ Mount-vibes-app menu filter:", mountVibesMenuStyle.filter);
  console.log(
    "✅ Vibe-control login button filter:",
    vibeControlLoginStyle.filter,
  );
  console.log(
    "❌ Mount-vibes-app login button filter:",
    mountVibesLoginStyle.filter,
  );

  // Check if mount-vibes-app has inherited blur (this should NOT happen)
  const mountVibesHasInheritedBlur =
    mountVibesMenuStyle.filter !== "none" &&
    mountVibesMenuStyle.filter.includes("blur");

  const vibeControlHasNoBlur =
    vibeControlMenuStyle.filter === "none" ||
    !vibeControlMenuStyle.filter.includes("blur");

  console.log("🚨 PROBLEM DETECTED:");
  console.log(
    `   Mount-vibes-app menu has inherited blur: ${mountVibesHasInheritedBlur}`,
  );
  console.log(`   Vibe-control menu has no blur: ${vibeControlHasNoBlur}`);

  // Document the problem for fixing
  console.log("📝 ROOT CAUSE:");
  console.log("   Mount-vibes-app applies blur to document.body");
  console.log(
    "   This causes ALL child elements (including our menu) to inherit blur",
  );
  console.log(
    "   Vibe-control only blurs the content wrapper, not the menu container",
  );

  console.log("🔧 SOLUTION NEEDED:");
  console.log("   Mount-vibes-app should blur only pre-existing content");
  console.log("   Our injected menu elements should remain sharp");

  // Take comparison screenshots
  await page.screenshot({ path: "blur-comparison-full.png", fullPage: true });

  console.log("✅ Blur comparison test completed!");
  console.log("📁 Files saved:");
  console.log("   - vibe-control-blur-test.png (correct - sharp menu)");
  console.log("   - mount-vibes-app-blur-test.png (incorrect - blurred menu)");
  console.log("   - blur-comparison-full.png (full page comparison)");
});
