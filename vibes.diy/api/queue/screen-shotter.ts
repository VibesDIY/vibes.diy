import puppeteer from "@cloudflare/puppeteer";
import { EvtNewFsId } from "@vibes.diy/api-types";
import { exception2Result, Result } from "@adviser/cement";
import { storeScreenshot } from "./intern/store-screenshot.js";
import { QueueCtx } from "./queue-ctx.js";
import { Fetcher } from "@cloudflare/workers-types";

/**
 * Takes a screenshot of a URL using Cloudflare Browser Rendering API
 */
export async function takeScreenshot(event: EvtNewFsId, browserFetcher: Fetcher): Promise<Result<Uint8Array>> {
  console.log(`Taking screenshot for ${event.vibeUrl} (fsId: ${event.fsId})`);

  return exception2Result(async () => {
    const browser = await puppeteer.launch(browserFetcher as never);
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

    await browser.close();
    return screenshot;
  });
}

/**
 * Process a screenshot event from the queue
 */
export async function processScreenShotEvent(qctx: QueueCtx, evt: EvtNewFsId): Promise<Result<void>> {
  const rScreenshot = await takeScreenshot(evt, qctx.params.cf.BROWSER);
  if (rScreenshot.isErr()) {
    return Result.Err(`Failed to take screenshot: ${rScreenshot.Err().message}`);
  }
  const screenshotData = new Uint8Array(rScreenshot.Ok());

  console.log(`Screenshot taken for ${evt.fsId}: ${screenshotData.byteLength} bytes`);

  const result = await storeScreenshot(qctx, evt.fsId, screenshotData);

  if (result.isErr()) {
    return Result.Err(`Failed to store screenshot: ${result.Err()}`);
  }
  console.log(`Screenshot stored with assetId: ${result.Ok().assetUrl}`);
  return Result.Ok(undefined);
}
