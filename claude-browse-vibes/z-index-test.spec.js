import { test, expect } from "@playwright/test";

test("Z-index layering test", async ({ page }) => {
  console.log("🔍 Testing z-index layering...");

  // Go to mount-vibes-app
  await page.goto("http://localhost:5173/mount-vibes-app?mock_login=true");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  console.log("📸 Taking initial screenshot...");
  await page.screenshot({ path: "z-index-initial.png", fullPage: true });

  // Check if button exists and get its z-index
  const button = page.locator('button[aria-haspopup="dialog"]');
  await expect(button).toBeVisible({ timeout: 10000 });
  
  const buttonStyles = await button.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      zIndex: computed.zIndex,
      position: computed.position,
      bottom: computed.bottom,
      right: computed.right,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    };
  });
  
  console.log("🔘 Button styles:", buttonStyles);

  // Check content wrapper styles  
  const contentWrapper = page.locator('#vibes-original-content').first();
  const contentStyles = await contentWrapper.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      zIndex: computed.zIndex,
      position: computed.position,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    };
  });
  
  console.log("📄 Content wrapper styles:", contentStyles);

  // Try to programmatically click the button
  console.log("👆 Attempting programmatic click...");
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-haspopup="dialog"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  
  console.log("✅ Programmatic click result:", clicked);
  
  if (clicked) {
    await page.waitForTimeout(1000);
    
    // Check if menu appeared
    const menu = page.locator('#hidden-menu');
    const menuVisible = await menu.isVisible().catch(() => false);
    console.log("📋 Menu visible after click:", menuVisible);
    
    if (menuVisible) {
      console.log("📸 Taking screenshot with menu open...");
      await page.screenshot({ path: "z-index-menu-open.png", fullPage: true });
      
      // Check menu z-index
      const menuStyles = await menu.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          zIndex: computed.zIndex,
          position: computed.position,
          filter: computed.filter
        };
      });
      console.log("📋 Menu styles:", menuStyles);
      
      // Check content wrapper z-index after menu opens
      const contentStylesOpen = await contentWrapper.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          zIndex: computed.zIndex,
          filter: computed.filter,
          transform: computed.transform
        };
      });
      console.log("📄 Content wrapper styles (menu open):", contentStylesOpen);
    }
  }
  
  console.log("✅ Z-index test completed!");
});