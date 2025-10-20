import { test, expect } from "@playwright/test";

test("Vibesbox local test - iframe and executeCode functionality", async ({
  page,
}) => {
  // Capture all console logs
  const consoleLogs = [];
  page.on("console", (msg) => {
    const logText = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(logText);
    console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());
  });

  // Capture page errors
  page.on("pageerror", (err) => {
    console.log(`[PAGE ERROR]`, err.message);
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  // Capture request failures
  page.on("requestfailed", (request) => {
    console.log(
      `[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`,
    );
  });

  console.log("🚀 Testing Vibesbox at localhost:8989...");

  // Test the wrapper page first
  console.log("📖 Loading wrapper page at /vibe/quick-cello-8104...");
  await page.goto("http://localhost:8989/vibe/quick-cello-8104", {
    waitUntil: "networkidle",
  });

  // Wait for iframe to be present
  console.log("🔍 Waiting for iframe to load...");
  const iframe = page.frameLocator("#vibeFrame");

  // Check if iframe exists
  const iframeElement = page.locator("#vibeFrame");
  await expect(iframeElement).toBeVisible({ timeout: 5000 });
  console.log("✅ Iframe is visible");

  // Get iframe src attribute
  const iframeSrc = await iframeElement.getAttribute("src");
  console.log(`📍 Iframe src: ${iframeSrc}`);
  expect(iframeSrc).toBe("/"); // Should be "/" by default

  // Check for loading indicator
  const loadingDiv = page.locator("#loading");
  console.log("🔄 Checking loading state...");

  // Wait a moment for scripts to initialize
  await page.waitForTimeout(2000);

  // Listen for messages from iframe
  await page.evaluate(() => {
    window.addEventListener("message", (event) => {
      console.log(`[MESSAGE FROM ${event.origin}]`, JSON.stringify(event.data));
    });
  });

  // Test posting a message to the iframe
  console.log("📤 Sending test execute-code message to iframe...");
  await page.evaluate(() => {
    const iframe = document.getElementById("vibeFrame");
    const testCode = `
      import React from 'react';
      
      function TestComponent() {
        console.log('TestComponent rendered from vibesbox test!');
        return React.createElement('div', {
          style: { padding: '20px', background: '#4CAF50', color: 'white' }
        }, 'Hello from Vibesbox Test!');
      }
      
      export default TestComponent;
    `;

    // Wait for iframe to be ready
    setTimeout(() => {
      console.log("Sending execute-code message...");
      iframe.contentWindow.postMessage(
        {
          type: "execute-code",
          code: testCode,
          sessionId: "test-session",
          debug: "*",
        },
        "*",
      );
    }, 1000);
  });

  // Wait for execution
  await page.waitForTimeout(3000);

  // Take screenshots
  console.log("📸 Taking screenshots...");
  await page.screenshot({
    path: test.info().outputPath("vibesbox-wrapper.png"),
    fullPage: true,
  });

  // Now test the iframe directly
  console.log("\n📖 Testing iframe directly at /...");
  await page.goto("http://localhost:8989/", {
    waitUntil: "networkidle",
  });

  // Check for container element
  const container = page.locator("#container");
  await expect(container).toBeVisible({ timeout: 5000 });
  console.log("✅ Container element is visible");

  // Check that babel and other scripts loaded
  await page.waitForFunction(
    () => {
      return typeof window.Babel !== "undefined";
    },
    { timeout: 5000 },
  );
  console.log("✅ Babel is loaded");

  // Check for React
  await page.waitForFunction(
    () => {
      return typeof window.React !== "undefined";
    },
    { timeout: 5000 },
  );
  console.log("✅ React is loaded");

  // Test executeCode directly
  console.log("📤 Testing executeCode function directly...");
  const executeResult = await page.evaluate(() => {
    // Check if executeCode is defined
    if (typeof executeCode === "undefined") {
      return { error: "executeCode is not defined" };
    }

    // Try to execute some code
    try {
      executeCode({
        code: `
          console.log('Direct execution test');
          export default function() { return 'Success'; }
        `,
        sessionId: "direct-test",
      });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  if (executeResult.error) {
    console.error(`❌ ExecuteCode error: ${executeResult.error}`);
  } else {
    console.log("✅ ExecuteCode function works");
  }

  await page.waitForTimeout(1000);

  // Take screenshot of iframe page
  await page.screenshot({
    path: test.info().outputPath("vibesbox-iframe.png"),
    fullPage: true,
  });

  // Print all collected console logs
  console.log("\n📋 All console logs collected:");
  consoleLogs.forEach((log) => console.log(log));

  // Test the lab page
  console.log("\n📖 Testing lab page at /lab/test-slug...");
  await page.goto("http://localhost:8989/lab/test-slug", {
    waitUntil: "networkidle",
  });

  // Check for lab elements
  const vibeSlugInput = page.locator("#vibeSlug");
  await expect(vibeSlugInput).toBeVisible({ timeout: 5000 });
  const slugValue = await vibeSlugInput.inputValue();
  console.log(`✅ Lab page loaded, slug input value: ${slugValue}`);
  expect(slugValue).toBe("test-slug");

  // Check for session selector
  const sessionSelect = page.locator("#sessionSelect");
  await expect(sessionSelect).toBeVisible();
  console.log("✅ Session selector is visible");

  // Take screenshot of lab
  await page.screenshot({
    path: test.info().outputPath("vibesbox-lab.png"),
    fullPage: true,
  });

  console.log("\n✅ All tests completed successfully!");
});
