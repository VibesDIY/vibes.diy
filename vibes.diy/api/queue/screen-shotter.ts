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
  console.info(`Taking screenshot for ${event.vibeUrl} (fsId: ${event.fsId})`);

  const rBrowser = await exception2Result(() => puppeteer.launch(browserFetcher as never));
  if (rBrowser.isErr()) {
    return Result.Err(rBrowser.Err());
  }
  const browser = rBrowser.Ok();
  const rScreenshot = await exception2Result(async () => {
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

    // `event.vibeUrl` is the app-host entry point (calcEntryPointUrl: `app--owner
    // .host/~fsId~`), NOT the `/vibe/:owner/:slug` viewer route directly. But this
    // is a top-level navigation, so Chromium sends `Sec-Fetch-Dest: document` and
    // the entry point 302-redirects it to the canonical viewer route (#2354, see
    // serv-entry-point.ts `isBareHostTopLevelNavigation`). fsIds are base58btc
    // (multibase `z…`), so `/~fsId~` normalizes to path "/" and trips the bare-host
    // guard. Puppeteer follows the 302, so the captured document is the viewer route.
    //
    // That route shows a "Verifying access…" chip (a toast) while it resolves the
    // viewer's grant, and the app only paints once that clears. `networkidle0` can
    // settle while this is still on screen (grant resolution rides a WebSocket, which
    // idle detection ignores), so wait for the chip to disappear before capturing —
    // otherwise we shoot the loading state, not the app. Bounded so a stuck/never-
    // shown chip can't hang the job; we fall through on timeout.
    await page
      .waitForFunction(() => !document.body.innerText.includes("Verifying access"), { timeout: 15000, polling: 100 })
      .catch(() => {
        console.warn(`"Verifying access" chip did not clear within timeout for ${event.vibeUrl}; capturing anyway`);
      });

    // Give the page an extra moment after access resolves so the full render
    // (post-hydration paint, fonts, late layout) can settle before capture.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return page.screenshot({
      type: "jpeg",
      quality: 85,
      fullPage: false,
    });
  });
  await browser.close();
  return rScreenshot;
}

/**
 * Process a screenshot event from the queue
 */
export async function processScreenShotEvent(qctx: QueueCtx, evt: EvtNewFsId): Promise<Result<{ assetUrl: string }>> {
  const rScreenshot = await takeScreenshot(evt, qctx.params.cf.BROWSER);
  if (rScreenshot.isErr()) {
    return Result.Err(`Failed to take screenshot: ${rScreenshot.Err().message}`);
  }
  const screenshotData = new Uint8Array(rScreenshot.Ok());

  console.info(`Screenshot taken for ${evt.fsId}: ${screenshotData.byteLength} bytes`);

  const result = await storeScreenshot(qctx, evt.fsId, screenshotData);

  if (result.isErr()) {
    return Result.Err(`Failed to store screenshot: ${result.Err()}`);
  }
  const { assetUrl } = result.Ok();
  console.info(`Screenshot stored with assetId: ${assetUrl}`);
  return Result.Ok({ assetUrl });
}
