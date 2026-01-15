import { test, expect } from "@playwright/test";

test("ImgGen food generation test - monitor console for 30s", async ({ page }) => {
  // Listen for console logs to capture ImgGen debug output
  page.on("console", (msg) => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  // Listen for network requests to see API calls
  page.on("request", (request) => {
    if (request.url().includes("vibecode.garden") || request.url().includes("api")) {
      console.log(`[NETWORK] ${request.method()} to: ${request.url()}`);
    }
  });

  // Listen for network responses
  page.on("response", (response) => {
    if (response.url().includes("vibecode.garden") || response.url().includes("api")) {
      console.log(`[NETWORK] Response ${response.status()} from: ${response.url()}`);
    }
  });

  console.log("🚀 Starting ImgGen food generation test...");

  // Navigate to the React example app
  console.log("📖 Navigating to localhost:5173...");
  await page.goto("http://localhost:5173");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Take initial screenshot
  await page.screenshot({ path: "imggen-test-start.png" });

  console.log("🔍 Looking for input elements...");

  // Try multiple selectors to find the prompt input
  const possibleInputSelectors = [
    'input[type="text"]',
    'input[placeholder*="prompt"]',
    'input[placeholder*="image"]',
    "input.prompt-input",
    ".input-container input",
    'form input[type="text"]',
  ];

  let promptInput = null;
  for (const selector of possibleInputSelectors) {
    const element = page.locator(selector);
    if ((await element.count()) > 0) {
      console.log(`✅ Found input with selector: ${selector}`);
      promptInput = element.first();
      break;
    }
  }

  if (!promptInput) {
    console.log("❌ No input element found! Available inputs:");
    const allInputs = page.locator("input");
    const count = await allInputs.count();
    console.log(`Found ${count} input elements total`);
    for (let i = 0; i < count; i++) {
      const input = allInputs.nth(i);
      const type = await input.getAttribute("type");
      const placeholder = await input.getAttribute("placeholder");
      const className = await input.getAttribute("class");
      console.log(`  Input ${i}: type="${type}" placeholder="${placeholder}" class="${className}"`);
    }
    await page.screenshot({ path: "imggen-test-no-input-found.png" });
    return;
  }

  console.log("✏️  Entering 'food' in the input field...");
  await promptInput.fill("food");

  // Take screenshot after entering text
  await page.screenshot({ path: "imggen-test-after-input.png" });

  console.log("🔘 Looking for Generate Image button...");

  // Try multiple selectors for the generate button
  const possibleButtonSelectors = [
    "button.generate-button",
    'button:has-text("Generate Image")',
    'button[type="submit"]:not([disabled])',
    'button:has-text("Generate"):not([disabled])',
    ".generate-button",
    "form button:not([disabled])",
  ];

  let generateButton = null;
  for (const selector of possibleButtonSelectors) {
    const element = page.locator(selector);
    if ((await element.count()) > 0) {
      // Check if element is visible and enabled
      const firstElement = element.first();
      if ((await firstElement.isVisible()) && (await firstElement.isEnabled())) {
        console.log(`✅ Found button with selector: ${selector}`);
        generateButton = firstElement;
        break;
      }
    }
  }

  if (!generateButton) {
    console.log("❌ No generate button found! Available buttons:");
    const allButtons = page.locator("button");
    const count = await allButtons.count();
    console.log(`Found ${count} button elements total`);
    for (let i = 0; i < count; i++) {
      const button = allButtons.nth(i);
      const text = await button.textContent();
      const type = await button.getAttribute("type");
      const className = await button.getAttribute("class");
      const disabled = await button.isDisabled();
      console.log(`  Button ${i}: text="${text}" type="${type}" class="${className}" disabled=${disabled}`);
    }
    await page.screenshot({ path: "imggen-test-no-button-found.png" });
    return;
  }

  console.log("🖱️  Clicking Generate Image button...");
  await generateButton.click();

  // Take screenshot after clicking button
  await page.screenshot({ path: "imggen-test-after-click.png" });

  console.log("⏱️  Monitoring console logs and network activity for 60 seconds...");
  console.log("📊 Watch for ImgGen component activity, API calls, AI responses, and any errors...");

  // Monitor for 60 seconds, taking screenshots every 15 seconds
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(15000);
    console.log(`⏰ ${(i + 1) * 15} seconds elapsed...`);
    await page.screenshot({
      path: `imggen-test-progress-${(i + 1) * 15}s.png`,
    });
  }

  console.log("✅ 60 seconds completed. Test finished!");

  // Take final screenshot
  await page.screenshot({ path: "imggen-test-final.png" });
});
