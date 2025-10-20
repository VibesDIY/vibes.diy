import { test, expect } from "@playwright/test";

test("Quick vibesbox syntax error check", async ({ page }) => {
  test.setTimeout(10000); // 10 second timeout

  const errors = [];

  // Capture errors
  page.on("pageerror", (err) => {
    errors.push(err.message);
    console.log(`❌ PAGE ERROR: ${err.message}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`❌ CONSOLE ERROR: ${msg.text()}`);
    }
  });

  console.log("🚀 Loading http://localhost:8989/...");

  // Go directly to iframe page
  await page.goto("http://localhost:8989/", {
    waitUntil: "domcontentloaded",
    timeout: 5000,
  });

  // Wait just a moment for errors to appear
  await page.waitForTimeout(1000);

  // Check for the specific regex error
  const hasRegexError = errors.some(
    (err) =>
      err.includes("Invalid regular expression") || err.includes("missing /"),
  );

  if (hasRegexError) {
    console.log("❌ REGEX SYNTAX ERROR FOUND!");
    console.log("Errors:", errors);
  }

  // Check if executeCode exists
  const hasExecuteCode = await page.evaluate(() => {
    return typeof executeCode !== "undefined";
  });

  console.log(`executeCode function exists: ${hasExecuteCode}`);

  // Take screenshot
  await page.screenshot({
    path: test.info().outputPath("vibesbox-error-check.png"),
  });

  // Fail if we have the regex error
  expect(hasRegexError).toBe(false);
  expect(hasExecuteCode).toBe(true);
});
