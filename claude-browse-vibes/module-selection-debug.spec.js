import { test, expect } from "@playwright/test";

test("debug module/options selection undefined response", async ({ page }) => {
  // Listen for console logs to capture the debug output
  const logs = [];
  page.on("console", (msg) => {
    if (msg.text().includes("Module/options selection")) {
      logs.push(msg.text());
      console.log(`[CONSOLE] ${msg.text()}`);
    }
  });

  // Listen for network requests to see API calls
  const apiCalls = [];
  page.on("request", (request) => {
    if (request.url().includes("vibes-diy-api.com")) {
      apiCalls.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
      });
      console.log(`[API CALL] ${request.method()} ${request.url()}`);
    }
  });

  page.on("response", (response) => {
    if (response.url().includes("vibes-diy-api.com")) {
      console.log(`[API RESPONSE] ${response.status()} ${response.url()}`);
    }
  });

  // Navigate to the problematic URL
  console.log("Navigating to URL with superhero images prompt...");
  await page.goto("http://localhost:8889/chat/123?prompt=superhero%20images");

  // Wait a bit for the page to load and make API calls
  await page.waitForTimeout(3000);

  // Look for the chat input and submit button
  const chatInput = page.locator('[data-testid="chat-input"]');
  const submitButton = page.locator('[data-testid="submit-button"]');

  if (await chatInput.isVisible()) {
    console.log("Chat input found, submitting the prompt...");

    // Submit the prompt to trigger the module selection
    await submitButton.click();

    // Wait for the API calls and logs
    await page.waitForTimeout(5000);
  } else {
    console.log("Chat input not found, waiting for page to fully load...");
    await page.waitForTimeout(2000);
  }

  // Check the captured logs
  console.log("\n=== CAPTURED LOGS ===");
  logs.forEach((log) => console.log(log));

  console.log("\n=== API CALLS ===");
  apiCalls.forEach((call) => console.log(`${call.method} ${call.url}`));

  // Look for the specific problematic log
  const undefinedResponseLog = logs.find(
    (log) => log.includes("Module/options selection raw response:") && log.includes("undefined")
  );

  if (undefinedResponseLog) {
    console.log("\n❌ FOUND UNDEFINED RESPONSE LOG:", undefinedResponseLog);

    // Check if there were any timeout or error logs
    const timeoutLog = logs.find((log) => log.includes("API call timed out"));
    const errorLog = logs.find((log) => log.includes("API call failed with error"));
    const successLog = logs.find((log) => log.includes("API call completed successfully"));

    if (timeoutLog) {
      console.log("🕐 TIMEOUT DETECTED:", timeoutLog);
    }
    if (errorLog) {
      console.log("❌ ERROR DETECTED:", errorLog);
    }
    if (successLog) {
      console.log("✅ SUCCESS LOG FOUND:", successLog);
    }

    // This is the bug we're trying to fix - fail the test to make it visible
    expect(undefinedResponseLog).toBeFalsy();
  } else {
    console.log("✅ No undefined response detected");
  }

  // Keep the page open for manual inspection if needed
  await page.waitForTimeout(1000);
});
