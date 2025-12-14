import { z } from "zod";
import { App, PublishEvent } from "./types.js";
import { callAI, imageGen } from "call-ai";
import type { DurableDatabase, UsageAggregates } from "./durable-database.js";

// Usage tracking message schema
// Includes optional inline usage data extracted from streaming response
const UsageTrackingMessage = z.object({
  userId: z.string(),
  generationId: z.string(),
  // Timestamp when request was made (seconds since epoch)
  createdAt: z.number(),
  // Inline usage data (from streaming/non-streaming response)
  model: z.string().optional(),
  cost: z.number().optional(),
  tokensPrompt: z.number().optional(),
  tokensCompletion: z.number().optional(),
  hasUsageData: z.boolean().optional(), // true if data was extracted from response
});

interface AtProtoBlobResponse {
  blob: {
    $type: string;
    ref: {
      $link: string;
    };
    mimeType: string;
    size: number;
  };
}

export interface QueueEnv {
  KV: KVNamespace;
  DISCORD_WEBHOOK_URL?: string;
  BLUESKY_HANDLE?: string;
  BLUESKY_APP_PASSWORD?: string;
  CALLAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  SERVER_OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  USAGE_QUEUE?: Queue<{ userId: string; generationId: string }>;
  DURABLE_DATABASE?: DurableObjectNamespace<DurableDatabase>;
}

const AI_API_KEY_ENV_VARS = [
  "CALLAI_API_KEY",
  "OPENROUTER_API_KEY",
  "SERVER_OPENROUTER_API_KEY",
] as const;

type AiApiKeyEnvVar = (typeof AI_API_KEY_ENV_VARS)[number];

function getCallAiApiKey(env: QueueEnv): string | undefined {
  const typedEnv = env as QueueEnv & Record<AiApiKeyEnvVar, string | undefined>;

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

    // Call OpenRouter directly from the server
    const response = await callAI(messages, {
      apiKey,
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
    });
    return typeof response === "string" ? response.trim() : null;
  } catch (error) {
    console.error("Error generating app summary:", error);
    return null;
  }
}

async function generateAppIcon(
  app: z.infer<typeof App>,
  kv: KVNamespace,
  openaiApiKey?: string,
): Promise<string | null> {
  if (!openaiApiKey) {
    console.warn(`⚠️ OPENAI_API_KEY not set - skipping app icon generation`);
    return null;
  }

  try {
    const category = app.title || app.name || "app";
    const prompt = `Minimal black icon on a white background, enclosed in a circle, representing ${category}. Use clear, text-free imagery to convey the category. Avoid letters or numbers.`;

    // Call OpenAI directly from the server
    const response = await imageGen(prompt, {
      apiKey: openaiApiKey,
      size: "1024x1024",
      endpoint: "https://api.openai.com/v1/images/generations",
    });
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

export default {
  async queue(batch: MessageBatch, env: QueueEnv) {
    // Route based on queue name
    switch (batch.queue) {
      case "usage-tracking":
        await processUsageTrackingBatch(batch, env);
        break;
      case "publish-events-v2":
        await processPublishEventsBatch(batch, env);
        break;
      default:
        console.error(`❌ Unknown queue: ${batch.queue}`);
        // Ack all messages to avoid infinite retries
        for (const message of batch.messages) {
          message.ack();
        }
    }
  },
};

async function processUsageTrackingBatch(batch: MessageBatch, env: QueueEnv) {
  for (const message of batch.messages) {
    const result = UsageTrackingMessage.safeParse(message.body);
    if (!result.success) {
      console.error(`❌ Invalid usage tracking message:`, result.error);
      message.ack();
      continue;
    }

    try {
      await processUsageTracking(result.data, env);
      message.ack();
    } catch (error) {
      console.error(`❌ Error processing usage tracking:`, error);
      message.retry();
    }
  }
}

async function processPublishEventsBatch(batch: MessageBatch, env: QueueEnv) {
  for (const message of batch.messages) {
    const result = PublishEvent.safeParse(message.body);
    if (!result.success) {
      console.error(`❌ Invalid publish event:`, result.error);
      message.retry();
      continue;
    }

    try {
      await processAppEvent(result.data, env);
      message.ack();
    } catch (error) {
      console.error(`❌ Error processing message ${message.id}:`, error);
      message.retry();
    }
  }
}

// OpenRouter generation response type
interface OpenRouterGenerationResponse {
  data?: {
    model?: string;
    usage?: number;
    upstream_inference_cost?: number;
    tokens_prompt?: number;
    tokens_completion?: number;
  };
}

// TTL values in seconds
const DAILY_TTL = 48 * 60 * 60; // 48 hours
const MONTHLY_TTL = 35 * 24 * 60 * 60; // 35 days

async function processUsageTracking(
  data: z.infer<typeof UsageTrackingMessage>,
  env: QueueEnv,
) {
  if (!env.DURABLE_DATABASE) {
    console.error(`DURABLE_DATABASE not bound - cannot track usage`);
    return;
  }

  console.log(
    `Tracking usage for user=${data.userId} gen=${data.generationId}`,
  );

  // Use inline data if available, otherwise fetch from API (fallback)
  let model: string;
  let cost: number;
  let tokensPrompt: number;
  let tokensCompletion: number;

  if (data.hasUsageData) {
    // Use inline data from streaming/non-streaming response
    model = data.model || "unknown";
    cost = data.cost || 0;
    tokensPrompt = data.tokensPrompt || 0;
    tokensCompletion = data.tokensCompletion || 0;
    console.log(`Using inline usage data: $${cost.toFixed(4)}`);
  } else {
    // Fallback: fetch from OpenRouter API
    const apiKey = env.SERVER_OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error(`SERVER_OPENROUTER_API_KEY not set - cannot track usage`);
      return;
    }

    const genData = await fetchGenerationFromOpenRouter(
      data.generationId,
      apiKey,
    );
    if (!genData) {
      console.error(`Failed to fetch generation ${data.generationId}`);
      return;
    }

    model = genData.model;
    cost = genData.cost;
    tokensPrompt = genData.tokensPrompt;
    tokensCompletion = genData.tokensCompletion;
    console.log(`Fetched usage from API: $${cost.toFixed(4)}`);
  }

  // Get user's Durable Object
  const doId = env.DURABLE_DATABASE.idFromName(data.userId);
  const userDB = env.DURABLE_DATABASE.get(doId);

  // Record generation and get aggregates (single RPC call)
  // Use the request timestamp (not processing time) for correct day/month attribution
  const aggregates = await userDB.recordGeneration({
    id: data.generationId,
    model,
    cost,
    tokensPrompt,
    tokensCompletion,
    createdAt: data.createdAt,
  });

  // Write aggregates to KV for fast budget checks
  await writeAggregatesToKV(env.KV, data.userId, aggregates);

  console.log(
    `Usage tracked: $${cost.toFixed(4)} (daily: $${aggregates.daily.cost.toFixed(4)}, monthly: $${aggregates.monthly.cost.toFixed(4)})`,
  );
}

async function fetchGenerationFromOpenRouter(
  generationId: string,
  apiKey: string,
): Promise<{
  model: string;
  cost: number;
  tokensPrompt: number;
  tokensCompletion: number;
} | null> {
  try {
    const url = new URL("https://openrouter.ai/api/v1/generation");
    url.searchParams.set("id", generationId);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch generation ${generationId}: ${response.status}`,
      );
      return null;
    }

    const data = (await response.json()) as OpenRouterGenerationResponse;

    // Extract cost: use "usage" for non-BYOK, "upstream_inference_cost" for BYOK
    const cost = data.data?.usage || data.data?.upstream_inference_cost || 0;

    return {
      model: data.data?.model || "unknown",
      cost,
      tokensPrompt: data.data?.tokens_prompt || 0,
      tokensCompletion: data.data?.tokens_completion || 0,
    };
  } catch (error) {
    console.error(`Error fetching generation ${generationId}:`, error);
    return null;
  }
}

async function writeAggregatesToKV(
  kv: KVNamespace,
  userId: string,
  aggregates: UsageAggregates,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const month = new Date().toISOString().slice(0, 7);
  const now = Date.now();

  await Promise.all([
    kv.put(
      `cost:daily:${userId}:${today}`,
      JSON.stringify({
        cost: aggregates.daily.cost,
        tokensPrompt: aggregates.daily.tokensPrompt,
        tokensCompletion: aggregates.daily.tokensCompletion,
        lastUpdated: now,
      }),
      { expirationTtl: DAILY_TTL },
    ),
    kv.put(
      `cost:monthly:${userId}:${month}`,
      JSON.stringify({
        cost: aggregates.monthly.cost,
        tokensPrompt: aggregates.monthly.tokensPrompt,
        tokensCompletion: aggregates.monthly.tokensCompletion,
        lastUpdated: now,
      }),
      { expirationTtl: MONTHLY_TTL },
    ),
  ]);
}

async function processAppEvent(
  event: z.infer<typeof PublishEvent>,
  env: QueueEnv,
) {
  const { type, app } = event;

  // Reload app from KV to ensure freshness, as other processes (like re-deploy) might have updated it
  // This is critical to avoid overwriting newer data with stale data from the queue event
  let currentApp = app;
  try {
    const kvAppStr = await env.KV.get(app.slug);
    if (kvAppStr) {
      const kvApp = JSON.parse(kvAppStr);
      // Basic validation to ensure we got the right object
      if (kvApp.slug === app.slug) {
        currentApp = kvApp;
      }
    }
  } catch (error) {
    console.warn(
      `⚠️ Failed to reload app from KV for ${app.slug}, using event data:`,
      error,
    );
  }

  // Handle icon repair events separately
  if (type === "icon_repair") {
    const openaiApiKey = env.OPENAI_API_KEY;
    const iconKey = await generateAppIcon(currentApp, env.KV, openaiApiKey);

    if (iconKey) {
      currentApp.iconKey = iconKey;
      currentApp.hasIcon = true;

      try {
        await env.KV.put(currentApp.chatId, JSON.stringify(currentApp));
        await env.KV.put(currentApp.slug, JSON.stringify(currentApp));
        console.log(`✅ Repaired icon for app ${currentApp.slug}`);
      } catch (error) {
        console.error(
          `❌ Failed to save repaired app ${currentApp.slug} to KV:`,
          error,
        );
      }

      // Clear the under-repair flag
      const repairFlagKey = `${currentApp.slug}-icon-repair`;
      await env.KV.delete(repairFlagKey);
    } else {
      console.error(`❌ Failed to generate icon for ${currentApp.slug}`);
    }

    // Skip Discord/Bluesky posting for repair events
    return;
  }

  // Generate summary and icon if missing (for app_created/app_updated events)
  const callAiApiKey = getCallAiApiKey(env);
  const openaiApiKey = env.OPENAI_API_KEY;
  let appUpdated = false;

  const hasSummary =
    typeof currentApp.summary === "string" &&
    currentApp.summary.trim().length > 0;

  if (!hasSummary) {
    const summary = await generateAppSummary(currentApp, callAiApiKey);
    if (summary) {
      currentApp.summary = summary;
      appUpdated = true;
    }
  }

  const hasIcon = Boolean(currentApp.hasIcon && currentApp.iconKey);
  if (!hasIcon) {
    const iconKey = await generateAppIcon(currentApp, env.KV, openaiApiKey);
    if (iconKey) {
      currentApp.iconKey = iconKey;
      currentApp.hasIcon = true;
      appUpdated = true;
    }
  }

  // If we updated the app with AI content, save it back to KV
  if (appUpdated) {
    try {
      await env.KV.put(currentApp.chatId, JSON.stringify(currentApp));
      await env.KV.put(currentApp.slug, JSON.stringify(currentApp));
      console.log(`✅ Updated app ${currentApp.slug} with AI content`);
    } catch (error) {
      console.error(
        `❌ Failed to save updated app ${currentApp.slug} to KV:`,
        error,
      );
      // We continue with posting even if saving failed, using the enriched object in memory
    }
  }

  const tasks = [postToDiscord(currentApp, env)];

  // Add Bluesky posting if shareToFirehose is enabled
  if (
    currentApp.shareToFirehose &&
    env.BLUESKY_HANDLE &&
    env.BLUESKY_APP_PASSWORD
  ) {
    tasks.push(postToBluesky(currentApp, env));
  } else if (currentApp.shareToFirehose) {
    console.warn(`⚠️ shareToFirehose enabled but Bluesky credentials missing`);
  }

  const results = await Promise.allSettled(tasks);

  let hasFailure = false;
  results.forEach((result, index) => {
    // Discord is always task 0, Bluesky is task 1 (if enabled)
    const taskName = index === 0 ? "Discord" : "Bluesky";
    if (result.status === "rejected") {
      console.error(`❌ Task ${index} (${taskName}) failed:`, result.reason);
      hasFailure = true;
    }
  });

  if (hasFailure) {
    throw new Error("One or more tasks failed during event processing");
  }
}

async function postToDiscord(app: z.infer<typeof App>, env: QueueEnv) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.error(
      "Discord webhook URL not configured - skipping Discord notification",
    );
    return;
  }

  const appUrl = `https://vibes.diy/vibe/${app.slug}`;
  const remixOfUrl = app.remixOf
    ? `https://vibes.diy/vibe/${app.remixOf}`
    : null;
  const screenshotUrl = `https://${app.slug}.vibesdiy.work/screenshot.png`;
  const remixScreenshotUrl = app.remixOf
    ? `https://${app.remixOf}.vibesdiy.work/screenshot.png`
    : null;

  try {
    const promptField = app.prompt
      ? {
          name: "Prompt",
          value: `
\`\`\`
${app.prompt}
\`\`\``,
        }
      : null;

    const discordBody = {
      content: `🎉 New Vibe: **[${app.title || app.name}](${appUrl})**`,
      embeds: [
        {
          title: `${app.title || app.name} - ${app.slug}`,
          url: appUrl,
          color: 11184810,
          ...(app.remixOf ? { thumbnail: { url: remixScreenshotUrl } } : {}),
          image: { url: screenshotUrl },
          fields: [
            { name: "Updates", value: `${app.updateCount}`, inline: true },
            { name: "User", value: app.userId || "n/a", inline: true },
            { name: "Email", value: app.email || "n/a", inline: true },
            ...(app.remixOf
              ? [
                  {
                    name: "🔀 Remix",
                    value: `[of ${app.remixOf}](${remixOfUrl})`,
                    inline: true,
                  },
                ]
              : []),
            ...(promptField ? [promptField] : []),
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordBody),
    });

    if (!response.ok) {
      throw new Error(
        `Discord webhook failed: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error posting to Discord:", error);
    throw error;
  }
}

async function postToBluesky(app: z.infer<typeof App>, env: QueueEnv) {
  if (!env.BLUESKY_HANDLE || !env.BLUESKY_APP_PASSWORD) {
    throw new Error("Bluesky credentials not configured");
  }

  try {
    // Step 1: Create session
    const sessionResponse = await fetch(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: env.BLUESKY_HANDLE,
          password: env.BLUESKY_APP_PASSWORD,
        }),
      },
    );

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      throw new Error(
        `Failed to create Bluesky session: ${sessionResponse.status} ${errorText}`,
      );
    }

    const session = (await sessionResponse.json()) as {
      did: string;
      accessJwt: string;
      refreshJwt: string;
      handle: string;
    };

    // Step 2: Get screenshot from KV and upload as blob
    const screenshotKey = `${app.slug}-screenshot`;
    let thumbnailBlob = null;

    try {
      const screenshotData = await env.KV.get(screenshotKey, "arrayBuffer");
      if (screenshotData) {
        const blobResponse = await fetch(
          "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.accessJwt}`,
              "Content-Type": "image/png",
            },
            body: screenshotData,
          },
        );

        if (blobResponse.ok) {
          const blobResult = (await blobResponse.json()) as AtProtoBlobResponse;
          thumbnailBlob = blobResult.blob;
        } else {
          console.warn(
            `⚠️ Failed to upload screenshot blob: ${blobResponse.status}`,
          );
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error uploading screenshot blob:`, error);
    }

    // Step 3: Create post with external embed
    const appUrl = `https://vibes.diy/vibe/${app.slug}`;
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    let postText = `💽 ${app.title || app.name}`;
    if (app.remixOf) {
      postText += `\n\n🔀 Remix of ${app.remixOf}`;
    }

    // Create external embed for rich link preview
    const externalEmbed = {
      $type: "app.bsky.embed.external",
      external: {
        uri: appUrl,
        title: app.title || app.name,
        description: `A new vibe created on vibes.diy${app.remixOf ? ` (remix of ${app.remixOf})` : ""}`,
        ...(thumbnailBlob ? { thumb: thumbnailBlob } : {}),
      },
    };

    const post = {
      $type: "app.bsky.feed.post",
      text: postText,
      createdAt: now,
      embed: externalEmbed,
    };

    const postResponse = await fetch(
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessJwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: session.did,
          collection: "app.bsky.feed.post",
          record: post,
        }),
      },
    );

    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      throw new Error(
        `Failed to create Bluesky post: ${postResponse.status} ${errorText}`,
      );
    }
  } catch (error) {
    console.error("Error posting to Bluesky:", error);
    throw error;
  }
}
