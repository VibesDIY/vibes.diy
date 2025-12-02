// Debug test for infinite re-render issue on /groups page
import { test, expect, chromium } from "@playwright/test";

test("Debug infinite re-renders on groups page", async () => {
  console.log("🔍 Starting groups page infinite re-render debug test...");

  // Connect to existing Chrome instance with debugging port
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const context = contexts[0]; // Use the first context
  const pages = context.pages();

  // Find the groups page or create a new one
  let page = pages.find(p => p.url().includes('localhost:8890/groups'));
  if (!page) {
    page = await context.newPage();
    console.log("📄 Created new page");
  } else {
    console.log("📄 Found existing groups page");
  }

  // Array to collect console messages
  const consoleMessages = [];
  let useAllGroupsCount = 0;
  let useFireproofCount = 0;
  let groupsContentCount = 0;
  let useMemoCount = 0;

  // Listen for console messages
  page.on("console", (message) => {
    const text = message.text();
    const timestamp = Date.now();

    // Count specific hook calls
    if (text.includes("[useAllGroups] Hook called")) {
      useAllGroupsCount++;
    }
    if (text.includes("[useFireproof] Hook called")) {
      useFireproofCount++;
    }
    if (text.includes("[GroupsContent] Component rendering")) {
      groupsContentCount++;
    }
    if (text.includes("useMemo] Creating")) {
      useMemoCount++;
    }

    // Store all messages for analysis
    consoleMessages.push({
      type: message.type(),
      text: text,
      timestamp: timestamp,
    });

    // Print important messages in real-time
    if (
      text.includes("[useAllGroups]") ||
      text.includes("[useFireproof]") ||
      text.includes("[GroupsContent]") ||
      text.includes("useMemo")
    ) {
      console.log(`[${message.type()}] ${text}`);
    }

    // Stop test if we hit too many renders (infinite loop detected)
    if (useAllGroupsCount > 50) {
      console.log("🚨 INFINITE LOOP DETECTED - Stopping test");
      console.log(`📊 Total useAllGroups calls: ${useAllGroupsCount}`);
      console.log(`📊 Total useFireproof calls: ${useFireproofCount}`);
      console.log(`📊 Total GroupsContent renders: ${groupsContentCount}`);
      console.log(`📊 Total useMemo recreations: ${useMemoCount}`);
    }
  });

  // Listen for page errors
  page.on("pageerror", (error) => {
    console.log("❌ Page error:", error.message);
  });

  console.log("🌐 Navigating to /groups page...");

  // Navigate to the groups page
  // Using existing authenticated session
  await page.goto("http://localhost:8890/groups");

  // Wait a moment for the page to load
  await page.waitForTimeout(1000);

  console.log("⏱️  Waiting 5 seconds to observe render behavior...");

  // Wait for 5 seconds to observe the render behavior
  await page.waitForTimeout(5000);

  console.log("\n📊 FINAL ANALYSIS:");
  console.log(`Total console messages captured: ${consoleMessages.length}`);
  console.log(`useAllGroups calls: ${useAllGroupsCount}`);
  console.log(`useFireproof calls: ${useFireproofCount}`);
  console.log(`GroupsContent renders: ${groupsContentCount}`);
  console.log(`useMemo recreations: ${useMemoCount}`);

  // Analyze message patterns
  const messageTypes = {};
  const renderPatterns = [];

  consoleMessages.forEach((msg) => {
    // Count message types
    messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;

    // Collect render-related patterns
    if (
      msg.text.includes("[useAllGroups]") ||
      msg.text.includes("[useFireproof]") ||
      msg.text.includes("useMemo")
    ) {
      renderPatterns.push({
        message: msg.text.substring(0, 150),
        timestamp: msg.timestamp,
      });
    }
  });

  console.log("\n📈 Message type breakdown:");
  Object.entries(messageTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} messages`);
  });

  console.log("\n🔄 Render pattern analysis (showing first 30):");
  renderPatterns.slice(0, 30).forEach((pattern, index) => {
    console.log(`  ${index + 1}. ${pattern.message}`);
  });

  // Check for infinite loop indicators
  if (useAllGroupsCount > 30) {
    console.log("\n🚨 INFINITE RE-RENDER DETECTED!");
    console.log("useAllGroups is being called repeatedly.");

    // Look for useMemo logs to see if memoization is working
    const useMemoLogs = consoleMessages.filter(m => m.text.includes("useMemo] Creating"));
    console.log(`\n🔍 useMemo recreation count: ${useMemoLogs.length}`);
    if (useMemoLogs.length > 5) {
      console.log("⚠️  useMemo is recreating objects - memoization is failing!");
      console.log("First 10 useMemo logs:");
      useMemoLogs.slice(0, 10).forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.text}`);
      });
    } else {
      console.log("✅ useMemo seems to be working (low recreation count)");
      console.log("🔍 The issue is likely that the component is re-rendering for other reasons");
    }
  } else {
    console.log("\n✅ No infinite re-render detected in this test run.");
  }

  // Export detailed log for further analysis
  const detailedLog = {
    totalMessages: consoleMessages.length,
    useAllGroupsCalls: useAllGroupsCount,
    useFireproofCalls: useFireproofCount,
    groupsContentRenders: groupsContentCount,
    useMemoRecreations: useMemoCount,
    messageTypes,
    renderPatterns,
  };

  console.log("\n💾 Detailed log analysis complete");

  // Keep browser open for manual inspection
  console.log(
    "\n🔍 Keeping browser open for 5 seconds for manual inspection...",
  );
  await page.waitForTimeout(5000);
});
