import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on("console", (msg) => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  // Log any errors
  page.on("pageerror", (error) => {
    console.log(`[Page Error]`, error);
  });

  // Navigate to the app
  console.log("Navigating to http://localhost:5173/");
  await page.goto("http://localhost:5173/");

  // Wait for the page to load
  await page.waitForLoadState("networkidle");

  // Click on the Vibes Generator example
  console.log("Looking for Vibes Generator card...");
  const vibesCard = await page.locator('text="Vibes Generator"').first();
  if (await vibesCard.isVisible()) {
    console.log("Clicking on Vibes Generator card...");
    await vibesCard.click();
    await page.waitForTimeout(1000);

    // Check if we're on the Vibes Generator page
    const heading = await page.locator('h1:has-text("Vibes Generator")');
    if (await heading.isVisible()) {
      console.log("Successfully navigated to Vibes Generator page");

      // Type a prompt
      const promptInput = await page.locator('textarea[id="prompt-input"]');
      if (await promptInput.isVisible()) {
        console.log("Found prompt input, typing test prompt...");
        await promptInput.fill("a simple button that says hello");

        // Click Generate Component button
        const generateButton = await page.locator('button:has-text("Generate Component")');
        if (await generateButton.isVisible()) {
          console.log("Clicking Generate Component button...");
          await generateButton.click();

          // Wait a bit to see what happens
          await page.waitForTimeout(3000);

          // Check for any generated content
          const generatedSection = await page.locator('text="Generated Component"');
          if (await generatedSection.isVisible()) {
            console.log("Generated Component section appeared!");
          } else {
            console.log("No Generated Component section found");
          }

          // Check for loading state
          const loadingText = await page.locator('text="Generating your component"');
          if (await loadingText.isVisible()) {
            console.log("Loading state is visible");
          } else {
            console.log("No loading state visible");
          }

          // Check for errors
          const errorSection = await page.locator('text="Generation Failed"');
          if (await errorSection.isVisible()) {
            console.log("Error section is visible");
            const errorMessage = await page.locator('text="Generation Failed" + p').textContent();
            console.log("Error message:", errorMessage);
          }
        }
      } else {
        console.log("Could not find prompt input textarea");
      }
    }
  } else {
    console.log("Could not find Vibes Generator card");
  }

  // Keep browser open for debugging
  console.log("\nKeeping browser open. Press Ctrl+C to exit...");
  await new Promise(() => {});
})();
