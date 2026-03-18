import puppeteer from "@cloudflare/puppeteer";
import { CFEnv, EvtNewFsId, isEvtNewFsId, isMsgBase, msgBase } from "@vibes.diy/api-types";
import { R2ToS3Api, storeScreenshot } from "@vibes.diy/api-svc";
import { cfDrizzle } from "@vibes.diy/api-svc/cf-serve.js";
import { type } from "arktype";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { LoggerImpl } from "@adviser/cement";

/**
 * Takes a screenshot of a URL using Cloudflare Browser Rendering API
 */
export async function takeScreenshot(event: EvtNewFsId, env: CFEnv): Promise<Uint8Array> {
  console.log(`Taking screenshot for ${event.vibeUrl} (fsId: ${event.fsId})`);

  const browser = await puppeteer.launch(env.BROWSER as never);
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
export async function processScreenShotEvent(message: unknown, env: CFEnv): Promise<void> {
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

    const screenshot = await takeScreenshot(payload, env);
    const screenshotData = new Uint8Array(screenshot);

    console.log(`Screenshot taken for ${payload.fsId}: ${screenshotData.byteLength} bytes`);

    const { db } = await cfDrizzle(env);
    const sthis = ensureSuperThis({ logger: new LoggerImpl() });

    const result = await storeScreenshot({ db, s3Api: new R2ToS3Api(env.FS_IDS_BUCKET, sthis) }, payload.fsId, screenshotData);

    if (result.isErr()) {
      console.error(`Failed to store screenshot: ${result.Err()}`);
      return;
    }

    console.log(`Screenshot stored with assetId: ${result.Ok().assetUrl}`);
    return;
  }
  console.error("Received message with unrecognized payload:", payload);
}
