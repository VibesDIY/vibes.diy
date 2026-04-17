// Custom Playwright config for ImgVibes testing
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Specs live alongside this config inside claude-browse-vibes/
  testDir: ".",

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: "html",

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: "http://localhost:5173",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Take screenshots on failure
    screenshot: "only-on-failure",

    // Record video on failure
    video: "retain-on-failure",

    // Enable developer tools
    launchOptions: {
      devtools: true,
    },
  },

  projects: [
    {
      name: "chromium-debug",
      use: {
        ...devices["Desktop Chrome"],
        // Run in headed mode for debugging
        headless: false,
        // Slow down for debugging
        slowMo: 100,
      },
    },
  ],

  // Don't start a server - assume already running on 5173
  // (Remove webServer config entirely)
});
