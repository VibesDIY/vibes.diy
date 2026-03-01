import puppeteer from "@cloudflare/puppeteer";
import { EvtNewFsId, isEvtNewFsId, isMsgBase, msgBase } from "@vibes.diy/api-types";
import { storeScreenshot } from "@vibes.diy/api-svc";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { LoggerImpl } from "@adviser/cement";
import { Env } from "./env.js";
import { cfDrizzle } from "@vibes.diy/api-svc/cf-serve.js";
import { type } from "arktype";

/**
 * Takes a screenshot of a URL using Cloudflare Browser Rendering API
 */
export async function takeScreenshot(event: EvtNewFsId, env: Env): Promise<Uint8Array> {
  console.log(`Taking screenshot for ${event.vibeUrl} (fsId: ${event.fsId})`);

  const browser = await puppeteer.launch(env.BROWSER as never);
  try {
    const page = await browser.newPage();

    // Set viewport size
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    // Navigate to the URL
    await page.goto(event.vibeUrl, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Take screenshot as JPEG
    const screenshot = await page.screenshot({
      type: "jpeg",
      quality: 85, // 0-100, higher is better quality but larger file size
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
export async function processScreenShotEvent(message: unknown, env: Env): Promise<void> {
  if (!isMsgBase(message)) {
    const x = msgBase(message);
    if (x instanceof type.errors) {
      console.error("Received message that is not MsgBase but matches MsgBase structure:", x.summary, message);
    } else {
      console.error("Received message that is not MsgBase:", message);
    }
    return;
  }
  const payload = message.payload;
  if (isEvtNewFsId(payload)) {
    console.log("Processing ScreenShotEvent:", {
      shotUrl: payload.vibeUrl,
      fsId: payload.fsId,
    });
    // Take the screenshot
    const screenshot = await takeScreenshot(payload, env);

    // Convert ArrayBuffer to Uint8Array
    const screenshotData = new Uint8Array(screenshot);

    console.log(`Screenshot taken for ${payload.fsId}: ${screenshotData.byteLength} bytes`);

    const { db } = await cfDrizzle(env);
    // Initialize sthis and db for storage
    const sthis = ensureSuperThis({ logger: new LoggerImpl() });

    // Store the screenshot in the database
    const result = await storeScreenshot({ sthis, db }, payload.fsId, screenshotData);

    if (result.isErr()) {
      console.error(`Failed to store screenshot: ${result.Err()}`);
      return;
    }

    console.log(`Screenshot stored with assetId: ${result.Ok().assetUrl}`);
    return;
  }
  console.error("Received message with unrecognized payload:", payload);
}
