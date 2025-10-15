import { Bool, OpenAPIRoute } from "chanfana";

import { Context } from "hono";
import { z } from "zod";
import { Variables } from "../middleware/auth.js";
import {
  App,
  PublishEvent,
  type AppType,
  type PublishEventType,
} from "../types.js";
import { generateVibeSlug } from "../utils/slugGenerator.js";

/**
 * Process and save a screenshot from base64 data
 * @param kv KV namespace to store the screenshot
 * @param appData App data to update with screenshot info
 * @param base64Screenshot Base64 encoded screenshot data
 * @param keyIdentifier Identifier to use for the screenshot key (usually slug)
 * @returns Updated app data with screenshot information
 */
async function processScreenshot(
  kv: KVNamespace,
  _appData: AppType,
  base64Screenshot: string,
  keyIdentifier: string,
) {
  try {
    // Remove data:image prefix if present
    const base64Data = base64Screenshot.replace(/^data:image\/\w+;base64,/, "");

    // Decode base64 to array buffer
    const binaryData = atob(base64Data);
    const len = binaryData.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryData.charCodeAt(i);
    }

    // Save screenshot with a suffix ID
    const screenshotKey = `${keyIdentifier}-screenshot`;
    await kv.put(screenshotKey, bytes.buffer);
  } catch (error) {
    console.error("Error processing screenshot:", error);
  }
}

export class AppCreate extends OpenAPIRoute {
  schema = {
    tags: ["Apps"],
    summary: "Create a new App",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              chatId: z.string(),
              userId: z.string().optional(),
              code: z.string().optional(),
              raw: z.string().optional(),
              prompt: z.string().optional(),
              title: z.string().optional(),
              screenshot: z.string().nullable().optional(), // base64 encoded image
              remixOf: z.string().nullable().optional(), // slug of the original app if this is a remix
              shareToFirehose: z.boolean().optional(), // whether to post to Bluesky
              customDomain: z.string().nullable().optional(), // custom domain for the app
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns the created app",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              app: App,
            }),
          },
        },
      },
    },
  };

  async handle(c: Context<{ Variables: Variables; Bindings: Env }>) {
    const user = c.get("user");
    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();

    // Retrieve the validated request body
    const app = data.body;

    // const codeToSave = app.code || normalizeRawCode(app.raw);

    // Get the KV namespace from the context
    const kv = c.env.KV;

    // Check if the app with this chatId already exists
    const existingApp = await kv.get(app.chatId);

    let savedApp: z.infer<typeof App>;

    if (existingApp) {
      // If app exists, parse it and update the code
      const parsedApp = JSON.parse(existingApp);
      // if (parsedApp.rawCode)
      parsedApp.code = app.code;
      parsedApp.raw = app.raw;
      parsedApp.templatedCode = null;

      // Update prompt if provided
      if (app.prompt) {
        parsedApp.prompt = app.prompt;
      }

      // Increment update counter
      parsedApp.updateCount = (parsedApp.updateCount || 0) + 1;

      // Update title if provided
      if (app.title) {
        parsedApp.title = app.title;
      }

      // Update remixOf if provided
      if (app.remixOf) {
        parsedApp.remixOf = app.remixOf;
      }

      // Update userId if provided
      if (app.userId) {
        parsedApp.userId = app.userId;
      }

      // Update email if provided
      if (user?.email) {
        parsedApp.email = user.email;
      }

      // Update shareToFirehose if provided
      if (app.shareToFirehose !== undefined) {
        parsedApp.shareToFirehose = app.shareToFirehose;
      }

      // Handle custom domain update
      if (app.customDomain !== undefined) {
        // Remove old domain mapping if it exists and is different
        if (
          parsedApp.customDomain &&
          parsedApp.customDomain !== app.customDomain
        ) {
          await kv.delete(`domain:${parsedApp.customDomain}`);
        }

        // Add new domain mapping if provided (not null)
        if (app.customDomain) {
          await kv.put(`domain:${app.customDomain}`, parsedApp.slug);
        }

        parsedApp.customDomain = app.customDomain;
      }

      // Save the updated app back to KV
      await kv.put(parsedApp.chatId, JSON.stringify(parsedApp));
      await kv.put(parsedApp.slug, JSON.stringify(parsedApp));

      // Process screenshot if provided
      if (app.screenshot && app.screenshot.trim()) {
        await processScreenshot(kv, parsedApp, app.screenshot, parsedApp.slug);
      }

      savedApp = parsedApp;
    } else {
      const slug: string = generateVibeSlug();

      // Generate an app using the provided chatId and code
      const appToSave: z.infer<typeof App> = {
        name: `app-${Date.now()}`,
        slug: slug,
        code: app.code || "",
        raw: app.raw,
        prompt: app.prompt || null,
        chatId: app.chatId,
        userId: app.userId || null,
        email: user?.email || null,
        updateCount: 0,
        title: app.title || `App ${slug}`,
        remixOf: app.remixOf === undefined ? null : app.remixOf,
        hasScreenshot: false,
        shareToFirehose: app.shareToFirehose,
        customDomain: app.customDomain || null,
      };

      // Save the new app to KV storage using both chatId and slug as keys
      await kv.put(app.chatId, JSON.stringify(appToSave));
      await kv.put(slug, JSON.stringify(appToSave));

      // Add custom domain mapping if provided
      if (app.customDomain) {
        await kv.put(`domain:${app.customDomain}`, slug);
      }

      // Process screenshot if provided
      if (app.screenshot && app.screenshot.trim()) {
        await processScreenshot(kv, appToSave, app.screenshot, slug);
      }

      savedApp = appToSave;
    }

    // Send event to queue for processing
    try {
      if (!c.env.PUBLISH_QUEUE) {
        console.warn(
          "PUBLISH_QUEUE not configured - skipping event publishing",
        );
        return {
          success: true,
          app: savedApp,
        };
      }

      const event: z.infer<typeof PublishEvent> = {
        type:
          savedApp.updateCount && savedApp.updateCount > 0
            ? "app_updated"
            : "app_created",
        app: savedApp,
        metadata: {
          timestamp: Date.now(),
          userId: savedApp.userId || undefined,
          isUpdate: (savedApp.updateCount || 0) > 0,
        },
      };

      await c.env.PUBLISH_QUEUE.send(event);
    } catch (error) {
      console.error("Error sending to queue:", error);
      // Continue execution - queue failure shouldn't break app creation
    }

    // return the updated or saved app
    return {
      success: true,
      app: savedApp,
    };
  }
}

// Discord posting functionality moved to queue-consumer.ts
// This ensures faster API responses and better reliability

// EMERGENCY ROLLBACK: Uncomment this function and call it instead of queue.send() if needed
/*
async function postToDiscordDirect(app: z.infer<typeof App>) {
  const webhookUrl = "https://discord.com/api/webhooks/1362420377506152529/he_-FXmdsR7CWFnMDMPMCyG6bJNMRaOzJ_J-IYY3aghUy-Iqt1Vifd0xuFXKKAYwIlgm";
  // ... (original Discord posting logic)
}
*/
