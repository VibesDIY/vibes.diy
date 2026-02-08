import { test, expect } from "@playwright/test";

test("load sandbox and capture console errors", async ({ page }) => {
  const errors = [];
  const logs = [];
  const failedRequests = [];
  const allModuleResponses = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    } else {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    errors.push(`PAGE ERROR: ${err.message}`);
  });

  page.on("requestfailed", (req) => {
    errors.push(`REQUEST_FAILED: ${req.url()} reason=${req.failure()?.errorText}`);
  });

  page.on("response", (response) => {
    const url = response.url();
    const ct = response.headers()["content-type"] || "";
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${ct} ${url}`);
    }
    if (url.endsWith(".js") || url.endsWith(".mjs") || url.includes("~~transformed~~") || url.includes("/dist/")) {
      allModuleResponses.push(`${response.status()} ${ct} ${url}`);
      if (ct.includes("text/html")) {
        failedRequests.push(`MIME_MISMATCH ${response.status()} ${ct} ${url}`);
      }
    }
  });

  await page.goto("http://crop-hidden-blew--jchris.localhost:8888/", {
    waitUntil: "networkidle",
    timeout: 15000,
  });

  // Wait a bit for any async module loading
  await page.waitForTimeout(3000);

  console.log("=== CONSOLE LOGS ===");
  for (const log of logs) {
    console.log(log);
  }

  console.log("\n=== CONSOLE ERRORS ===");
  if (errors.length === 0) {
    console.log("No errors!");
  } else {
    for (const err of errors) {
      console.log(err);
    }
  }

  console.log("\n=== FAILED REQUESTS ===");
  for (const req of failedRequests) {
    console.log(req);
  }

  console.log("\n=== ALL JS/MODULE RESPONSES ===");
  for (const r of allModuleResponses) {
    console.log(r);
  }

  console.log("\n=== DOM STATE ===");
  const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
  console.log(bodyHTML);
});
