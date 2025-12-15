import { test, expect } from "@playwright/test";

test("Take screenshots of HomeScreen in light and dark mode", async ({
  page,
}) => {
  console.log("\n🚀 Loading: http://localhost:8001/\n");

  await page.goto("http://localhost:8001/", {
    waitUntil: "networkidle",
    timeout: 15000,
  });

  await page.waitForTimeout(3000);

  // Take light mode screenshot
  console.log("📸 Taking light mode screenshot...");
  await page.screenshot({
    path: "screenshots/homescreen-light.png",
    fullPage: false,
  });

  // Emulate dark mode
  console.log("🌙 Switching to dark mode...");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(1000);

  // Take dark mode screenshot
  console.log("📸 Taking dark mode screenshot...");
  await page.screenshot({
    path: "screenshots/homescreen-dark.png",
    fullPage: false,
  });

  console.log("\n✅ Screenshots saved to screenshots/ directory");
});
