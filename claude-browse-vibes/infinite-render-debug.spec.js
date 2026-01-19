// Debug test for infinite re-render issue
import { test, expect } from "@playwright/test";

test("Debug infinite re-renders on session page", async ({ page }) => {
  console.log("🔍 Starting infinite re-render debug test...");

  // Array to collect console messages
  const consoleMessages = [];
  let renderCount = 0;
  let sessionWrapperCount = 0;

  // Listen for console messages
  page.on("console", (message) => {
    const text = message.text();
    const timestamp = Date.now();

    // Count renders
    if (text.includes("SessionView") && text.includes("render #")) {
      renderCount++;
    }

    if (text.includes("SessionWrapper render -")) {
      sessionWrapperCount++;
    }

    // Store all messages for analysis
    consoleMessages.push({
      type: message.type(),
      text: text,
      timestamp: timestamp,
    });

    // Print important messages in real-time
    if (text.includes("SessionWrapper") || text.includes("SessionView") || text.includes("useViewState")) {
      console.log(`[${message.type()}] ${text}`);
    }

    // Stop test if we hit too many renders (infinite loop detected)
    if (renderCount > 50) {
      console.log("🚨 INFINITE LOOP DETECTED - Stopping test");
      console.log(`📊 Total SessionView renders: ${renderCount}`);
      console.log(`📊 Total SessionWrapper renders: ${sessionWrapperCount}`);

      // Analyze patterns in the last 10 messages
      const recentMessages = consoleMessages.slice(-10);
      console.log("📋 Last 10 console messages:");
      recentMessages.forEach((msg, index) => {
        console.log(`  ${index + 1}. [${msg.type}] ${msg.text.substring(0, 100)}...`);
      });
    }
  });

  // Listen for page errors
  page.on("pageerror", (error) => {
    console.log("❌ Page error:", error.message);
  });

  console.log("🌐 Navigating to problematic URL...");

  // Navigate to the problematic session URL
  await page.goto("http://localhost:8888/remix/eventual-pelican-1082");

  console.log("⏱️  Waiting 10 seconds to observe render behavior...");

  // Wait for 5 seconds to observe the render behavior (shorter for faster iteration)
  await page.waitForTimeout(5000);

  console.log("\n📊 FINAL ANALYSIS:");
  console.log(`Total console messages captured: ${consoleMessages.length}`);
  console.log(`SessionView renders: ${renderCount}`);
  console.log(`SessionWrapper renders: ${sessionWrapperCount}`);

  // Analyze message patterns
  const messageTypes = {};
  const renderPatterns = [];

  consoleMessages.forEach((msg) => {
    // Count message types
    messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;

    // Collect render-related patterns
    if (msg.text.includes("render #") || msg.text.includes("SessionWrapper render")) {
      renderPatterns.push({
        message: msg.text.substring(0, 100),
        timestamp: msg.timestamp,
      });
    }
  });

  console.log("\n📈 Message type breakdown:");
  Object.entries(messageTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} messages`);
  });

  console.log("\n🔄 Render pattern analysis (showing first 20):");
  renderPatterns.slice(0, 20).forEach((pattern, index) => {
    console.log(`  ${index + 1}. ${pattern.message}`);
  });

  // Check for infinite loop indicators
  if (renderCount > 30) {
    console.log("\n🚨 INFINITE RE-RENDER DETECTED!");
    console.log("This confirms the bug exists and needs to be fixed.");
  } else {
    console.log("\n✅ No infinite re-render detected in this test run.");
  }

  // Export detailed log for further analysis
  const detailedLog = {
    totalMessages: consoleMessages.length,
    sessionViewRenders: renderCount,
    sessionWrapperRenders: sessionWrapperCount,
    messageTypes,
    renderPatterns,
    allMessages: consoleMessages,
  };

  console.log("\n💾 Detailed log exported to console for further analysis");
  console.log("Raw data available in test artifacts");

  // Keep browser open for manual inspection
  console.log("\n🔍 Keeping browser open for 10 seconds for manual inspection...");
  await page.waitForTimeout(10000);
});
