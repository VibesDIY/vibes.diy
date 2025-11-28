import { Bool, OpenAPIRoute, contentJson } from "chanfana";

import { Context } from "hono";
import { z } from "zod";
import { App, PublishEvent } from "../types.js";
import { generateVibeSlug } from "@vibes.diy/hosting-base";
import { callAI, imageGen } from "call-ai";

const AI_API_KEY_ENV_VARS = [
  "CALLAI_API_KEY",
  "OPENROUTER_API_KEY",
  "SERVER_OPENROUTER_API_KEY",
] as const;

type AiApiKeyEnvVar = (typeof AI_API_KEY_ENV_VARS)[number];

// Variables type for context (was previously in deleted auth middleware)
interface Variables {
  user: { sub?: string; userId?: string; email?: string } | null;
}

/**
 * Process and save a screenshot from base64 data
 * @param kv KV namespace to store the screenshot
 * @param base64Screenshot Base64 encoded screenshot data
 * @param keyIdentifier Identifier to use for the screenshot key (usually slug)
 * @returns Updated app data with screenshot information
 */
async function processScreenshot(
  kv: KVNamespace,
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

function getCallAiApiKey(env: Env): string | undefined {
  const typedEnv = env as Env & Record<AiApiKeyEnvVar, string | undefined>;

  for (const key of AI_API_KEY_ENV_VARS) {
    const value = typedEnv[key];
    if (value) return value;
  }

  return undefined;
}

function base64ToArrayBuffer(base64Data: string) {
  if (typeof atob !== "function") {
    throw new Error(
      "base64ToArrayBuffer: atob is not available in this runtime",
    );
  }

  const binaryData = atob(base64Data);
  const len = binaryData.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }
  return bytes.buffer;
}

async function generateAppSummary(
  app: z.infer<typeof App>,
  apiKey?: string,
): Promise<string | null> {
  if (!apiKey) {
    console.warn(
      `⚠️ AI API key not set (${AI_API_KEY_ENV_VARS.join(", ")}) - skipping app summary generation`,
    );
    return null;
  }

  try {
    const contextPieces = [
      app.title ? `Title: ${app.title}` : null,
      app.prompt ? `Prompt: ${app.prompt}` : null,
      app.code ? `Code snippet: ${app.code.slice(0, 1000)}` : null,
    ].filter(Boolean);

    const messages = [
      {
        role: "system" as const,
        content:
          "You write concise, single-sentence summaries of small web apps. Keep it under 35 words, highlight the main category and what the app helps users do.",
      },
      {
        role: "user" as const,
        content: contextPieces.join("\n\n"),
      },
    ];

    const response = await callAI(messages, { apiKey });
    return typeof response === "string" ? response.trim() : null;
  } catch (error) {
    console.error("Error generating app summary:", error);
    return null;
  }
}

async function generateAppIcon(
  app: z.infer<typeof App>,
  kv: KVNamespace,
  apiKey?: string,
): Promise<string | null> {
  if (!apiKey) {
    console.warn(
      `⚠️ AI API key not set (${AI_API_KEY_ENV_VARS.join(", ")}) - skipping app icon generation`,
    );
    return null;
  }

  try {
    const category = app.title || app.name || "app";
    const prompt = `Minimal black icon on a white background, enclosed in a circle, representing ${category}. Use clear, text-free imagery to convey the category. Avoid letters or numbers.`;
    const response = await imageGen(prompt, { apiKey, size: "512x512" });
    const iconBase64 = response.data?.[0]?.b64_json;

    if (!iconBase64) {
      console.warn("⚠️ No icon data returned from imageGen");
      return null;
    }

    const iconArrayBuffer = base64ToArrayBuffer(iconBase64);
    const iconKey = `${app.slug}-icon`;
    await kv.put(iconKey, iconArrayBuffer);
    return iconKey;
  } catch (error) {
    console.error("Error generating app icon:", error);
    return null;
  }
}

// Request body schema for app creation
const AppCreateRequestSchema = z.object({
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
});

type AppCreateRequest = z.infer<typeof AppCreateRequestSchema>;

export class AppCreate extends OpenAPIRoute {
  schema = {
    tags: ["Apps"],
    summary: "Create a new App",
    request: {
      body: contentJson(AppCreateRequestSchema),
    },
    responses: {
      "200": {
        description: "Returns the created app",
        ...contentJson(
          z.object({
            success: Bool(),
            app: App,
          }),
        ),
      },
    },
  };

  async handle(c: Context<{ Variables: Variables; Bindings: Env }>) {
    const user = c.get("user");

    // Require authentication for app creation and modification
    if (!user || !user.userId) {
      return c.json(
        {
          error:
            "Authentication required. Please log in to create or modify apps.",
        },
        401,
      );
    }

    // Get validated data
    const data = await this.getValidatedData<typeof this.schema>();

    // Retrieve the validated request body with proper type
    const app = data.body as unknown as AppCreateRequest;

    // const codeToSave = app.code || normalizeRawCode(app.raw);

    // Get the KV namespace from the context
    const kv = c.env.KV;
    const callAiApiKey = getCallAiApiKey(c.env);

    // Check if the app with this chatId already exists
    const existingApp = await kv.get(app.chatId);

    let savedApp: z.infer<typeof App>;

    if (existingApp) {
      // If app exists, parse it and update the code
      const parsedApp = JSON.parse(existingApp);

      // Verify ownership - user must own the app to modify it
      if (parsedApp.userId && parsedApp.userId !== user.userId) {
        return c.json(
          {
            error: "Forbidden: You don't have permission to modify this app.",
          },
          403,
        );
      }

      // if (parsedApp.rawCode)
      // Only update code fields if they are provided in the request
      if (app.code !== undefined) {
        parsedApp.code = app.code;
      }
      if (app.raw !== undefined) {
        parsedApp.raw = app.raw;
      }
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
        await processScreenshot(kv, app.screenshot, parsedApp.slug);
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
        summary: null,
        iconKey: null,
        hasIcon: false,
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
        await processScreenshot(kv, app.screenshot, slug);
      }

      savedApp = appToSave;
    }

    const hasSummary =
      typeof savedApp.summary === "string" &&
      savedApp.summary.trim().length > 0;
    if (!hasSummary) {
      const summary = await generateAppSummary(savedApp, callAiApiKey);
      if (summary) {
        savedApp.summary = summary;
      }
    }

    const hasIcon = Boolean(savedApp.hasIcon && savedApp.iconKey);
    if (!hasIcon) {
      const iconKey = await generateAppIcon(savedApp, kv, callAiApiKey);
      if (iconKey) {
        savedApp.iconKey = iconKey;
        savedApp.hasIcon = true;
      }
    }

    // Persist any AI-enriched fields
    await kv.put(savedApp.chatId, JSON.stringify(savedApp));
    await kv.put(savedApp.slug, JSON.stringify(savedApp));

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
