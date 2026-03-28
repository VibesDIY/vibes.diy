import puppeteer from "@cloudflare/puppeteer";
import { EvtNewFsId } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";
import { storeScreenshot } from "./intern/store-screenshot.js";
import { QueueCtx } from "./queue-ctx.js";
import { Fetcher } from "@cloudflare/workers-types";

/**
 * Takes a screenshot of a URL using Cloudflare Browser Rendering API
 */
export async function takeScreenshot(event: EvtNewFsId, browserFetcher: Fetcher): Promise<Uint8Array> {
  console.log(`Taking screenshot for ${event.vibeUrl} (fsId: ${event.fsId})`);

  const browser = await puppeteer.launch(browserFetcher as never);
  try {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    await page.goto(event.vibeUrl, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 85,
      fullPage: false,
    });

    return screenshot;
  } finally {
    await browser.close();
  }
}

/**
 * Process a screenshot event from the queue
 */
export async function processScreenShotEvent(qctx: QueueCtx, evt: EvtNewFsId): Promise<Result<void>> {
  const screenshot = await takeScreenshot(evt, qctx.params.cf.BROWSER);
  const screenshotData = new Uint8Array(screenshot);

  console.log(`Screenshot taken for ${evt.fsId}: ${screenshotData.byteLength} bytes`);

  const result = await storeScreenshot(qctx, evt.fsId, screenshotData);

  if (result.isErr()) {
    return Result.Err(`Failed to store screenshot: ${result.Err()}`);
  }
  console.log(`Screenshot stored with assetId: ${result.Ok().assetUrl}`);
  return Result.Ok();
}
