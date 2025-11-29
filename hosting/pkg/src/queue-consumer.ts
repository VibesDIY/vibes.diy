import { z } from "zod";
import { App, PublishEvent } from "./types.js";
import { callAI, imageGen } from "call-ai";

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
    for (const message of batch.messages) {
      const result = PublishEvent.safeParse(message.body);

      if (!result.success) {
        console.error(`❌ Invalid message format:`, result.error);
        message.retry();
        continue;
      }

      const event = result.data;

      try {
        await processAppEvent(event, env);
        message.ack();
      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error);
        message.retry();
      }
    }
  },
};

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

  // Generate summary and icon if missing
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
