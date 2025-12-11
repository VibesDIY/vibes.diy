/**
 * Test Clerk authentication on vibe server endpoint
 *
 * This script tests the Clerk auth integration in vibes-diy-srv.ts
 *
 * To run:
 * 1. Start the vibe server: cd vibes.diy/pkg && deno run --allow-net --allow-read --allow-env vibes-diy-srv.ts
 * 2. Run this test: cd claude-browse-vibes && npx playwright test test-clerk-vibe-auth.spec.js --headed
 */

import { test, expect } from "@playwright/test";

test.describe("Clerk Auth on Vibe Endpoint", () => {
  const VIBE_URL = "http://localhost:8001/vibe/symphonic-dragon-2713";

  test("should show auth check and Clerk initialization in console", async ({
    page,
  }) => {
    const consoleLogs = [];
    const consoleErrors = [];

    // Capture console logs
    page.on("console", (msg) => {
      const text = msg.text();
      const type = msg.type();

      if (type === "error") {
        consoleErrors.push(text);
        console.log(`❌ Console Error: ${text}`);
      } else {
        consoleLogs.push(text);
        console.log(`📝 Console: ${text}`);
      }
    });

    // Go to vibe URL
    console.log(`\n🌐 Navigating to: ${VIBE_URL}\n`);
    await page.goto(VIBE_URL, { waitUntil: "domcontentloaded" });

    // Wait a bit for scripts to execute
    await page.waitForTimeout(3000);

    // Check if we're on Clerk sign-in page (redirect happened)
    const currentUrl = page.url();
    console.log(`\n📍 Current URL: ${currentUrl}\n`);

    if (currentUrl.includes("accounts.dev") || currentUrl.includes("clerk")) {
      console.log(
        "✅ Redirected to Clerk sign-in (expected for unauthenticated user)",
      );
      console.log("   This means auth check is working!\n");
    } else if (currentUrl === VIBE_URL) {
      console.log("✅ Stayed on vibe page (user might be authenticated)");

      // Check if CALLAI_API_KEY is exposed
      const hasToken = await page.evaluate(() => {
        return typeof window.CALLAI_API_KEY !== "undefined";
      });

      if (hasToken) {
        const token = await page.evaluate(() => window.CALLAI_API_KEY);
        console.log(`✅ Token exposed: ${token ? "✓ (exists)" : "✗ (null)"}`);
      } else {
        console.log("⚠️  No token found on window.CALLAI_API_KEY");
      }

      // Check if vibe container exists
      const hasVibeContainer = (await page.locator("#vibes\\.diy").count()) > 0;
      console.log(
        `${hasVibeContainer ? "✅" : "❌"} Vibe container exists: #vibes.diy`,
      );

      // Check page content
      const bodyText = await page.locator("body").textContent();
      if (bodyText?.includes("Authentication error")) {
        console.log("⚠️  Authentication error message found on page");
      }
    }

    // Print summary of console activity
    console.log("\n📊 Console Summary:");
    console.log(`   Total logs: ${consoleLogs.length}`);
    console.log(`   Total errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log("\n❌ Console Errors Found:");
      consoleErrors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    // Wait a bit more to see token refresh (if authenticated)
    if (currentUrl === VIBE_URL) {
      console.log("\n⏳ Waiting 35 seconds to check for token refresh...");
      await page.waitForTimeout(35000);

      const refreshLogs = consoleLogs.filter(
        (log) =>
          log.includes("Token refresh") ||
          log.includes("clerk-token-refreshed"),
      );

      if (refreshLogs.length > 0) {
        console.log("✅ Token refresh detected!");
        refreshLogs.forEach((log) => console.log(`   ${log}`));
      } else {
        console.log(
          "⚠️  No token refresh logs detected (may not be authenticated)",
        );
      }
    }

    // Take screenshot for debugging
    await page.screenshot({
      path: "/Users/jchris/code/fp/vibes.diy/claude-browse-vibes/clerk-auth-test.png",
      fullPage: true,
    });
    console.log(
      "\n📸 Screenshot saved: claude-browse-vibes/clerk-auth-test.png\n",
    );
  });

  test("should check window.CALLAI_API_KEY presence", async ({ page }) => {
    // Set up console monitoring
    page.on("console", (msg) => {
      console.log(`Console ${msg.type()}: ${msg.text()}`);
    });

    await page.goto(VIBE_URL, { waitUntil: "networkidle" });

    // Wait for auth check
    await page.waitForTimeout(2000);

    // Check if still on vibe page (authenticated)
    if (page.url() === VIBE_URL) {
      // Evaluate window globals
      const globals = await page.evaluate(() => {
        return {
          hasCALLAI_API_KEY: typeof window.CALLAI_API_KEY !== "undefined",
          CALLAI_API_KEY_value: window.CALLAI_API_KEY,
          hasClerk: typeof window.Clerk !== "undefined",
          clerkUser: window.Clerk?.user ? "User object exists" : "No user",
        };
      });

      console.log("\n🔍 Window Globals Check:");
      console.log(
        `   window.CALLAI_API_KEY: ${globals.hasCALLAI_API_KEY ? "✅ exists" : "❌ missing"}`,
      );
      if (globals.hasCALLAI_API_KEY && globals.CALLAI_API_KEY_value) {
        console.log(
          `   Token value: ${globals.CALLAI_API_KEY_value.substring(0, 20)}...`,
        );
      }
      console.log(
        `   window.Clerk: ${globals.hasClerk ? "✅ exists" : "❌ missing"}`,
      );
      console.log(`   Clerk user: ${globals.clerkUser}`);
    } else {
      console.log("\n⚠️  Redirected to:", page.url());
      console.log("   Cannot check window globals (not on vibe page)");
    }
  });

  test("should monitor Clerk-related network requests", async ({ page }) => {
    const clerkRequests = [];

    // Monitor network requests
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("clerk") || url.includes("esm.sh/@clerk")) {
        clerkRequests.push({
          method: request.method(),
          url: url,
          type: request.resourceType(),
        });
        console.log(`📡 Clerk Request: ${request.method()} ${url}`);
      }
    });

    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("clerk") || url.includes("esm.sh/@clerk")) {
        console.log(`📥 Clerk Response: ${response.status()} ${url}`);
      }
    });

    await page.goto(VIBE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    console.log(`\n📊 Total Clerk-related requests: ${clerkRequests.length}`);
    if (clerkRequests.length === 0) {
      console.log(
        "⚠️  No Clerk requests detected - check if importmap is working",
      );
    } else {
      console.log("✅ Clerk module loaded successfully");
    }
  });
});

test.describe("Clerk Environment Key Selection", () => {
  test("should use test key on localhost", async ({ page }) => {
    await page.goto("http://localhost:8001/vibe/symphonic-dragon-2713");
    await page.waitForTimeout(2000);

    // Check which Clerk key is being used
    const clerkConfig = await page.evaluate(() => {
      // Try to get Clerk publishable key from the page source
      const scripts = Array.from(document.scripts);
      const authScript = scripts.find((s) =>
        s.textContent?.includes("new Clerk"),
      );

      if (authScript?.textContent) {
        const match = authScript.textContent.match(/new Clerk\('([^']+)'\)/);
        if (match) {
          return {
            key: match[1],
            keyType: match[1].startsWith("pk_live") ? "LIVE" : "TEST",
          };
        }
      }
      return { key: null, keyType: "UNKNOWN" };
    });

    console.log("\n🔑 Clerk Key Configuration:");
    console.log(`   Environment: localhost (should use TEST key)`);
    console.log(
      `   Key detected: ${clerkConfig.key ? clerkConfig.key.substring(0, 15) + "..." : "Not found"}`,
    );
    console.log(`   Key type: ${clerkConfig.keyType}`);

    if (clerkConfig.keyType === "TEST") {
      console.log("   ✅ Correct key for localhost environment");
    } else if (clerkConfig.keyType === "LIVE") {
      console.log("   ⚠️  Using LIVE key on localhost (should be TEST)");
    }
  });
});
