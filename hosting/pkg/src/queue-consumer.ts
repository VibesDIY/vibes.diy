import { z } from "zod";
import { App, PublishEvent } from "./types";

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
}

export default {
  async queue(batch: MessageBatch, env: QueueEnv) {
    console.log(`📦 Queue batch received: ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        console.log(`🔄 Processing message ID: ${message.id}`);
        const event = PublishEvent.parse(message.body);

        console.log(`📊 Event details:`, {
          type: event.type,
          appSlug: event.app.slug,
          userId: event.metadata.userId,
          isUpdate: event.metadata.isUpdate,
          timestamp: new Date(event.metadata.timestamp).toISOString(),
        });

        await processAppEvent(event, env);
        message.ack();
        console.log(`✅ Message ${message.id} processed successfully`);
      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error);
        message.retry();
        console.log(`🔄 Message ${message.id} scheduled for retry`);
      }
    }

    console.log(
      `🏁 Batch processing complete: ${batch.messages.length} messages handled`,
    );
  },
};

async function processAppEvent(
  event: z.infer<typeof PublishEvent>,
  env: QueueEnv,
) {
  const { type, app } = event;

  console.log(`🎯 Processing ${type} event for app ${app.slug}`);
  const startTime = Date.now();

  const tasks = [postToDiscord(app, env)];

  // Add Bluesky posting if shareToFirehose is enabled
  if (app.shareToFirehose && env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD) {
    tasks.push(postToBluesky(app, env));
    console.log(`🟦 Adding Bluesky posting task (shareToFirehose enabled)`);
  } else if (app.shareToFirehose) {
    console.warn(`⚠️ shareToFirehose enabled but Bluesky credentials missing`);
  }

  console.log(`🚀 Starting ${tasks.length} background tasks...`);
  const results = await Promise.allSettled(tasks);

  let hasFailure = false;
  results.forEach((result, index) => {
    // Discord is always task 0, Bluesky is task 1 (if enabled)
    const taskName = index === 0 ? "Discord" : "Bluesky";
    if (result.status === "rejected") {
      console.error(`❌ Task ${index} (${taskName}) failed:`, result.reason);
      hasFailure = true;
    } else {
      console.log(`✅ Task ${index} (${taskName}) completed successfully`);
    }
  });

  const duration = Date.now() - startTime;
  console.log(`⏱️ Event processing completed in ${duration}ms`);

  if (hasFailure) {
    throw new Error("One or more tasks failed during event processing");
  }
}

async function postToDiscord(app: z.infer<typeof App>, env: QueueEnv) {
  const webhookUrl =
    env.DISCORD_WEBHOOK_URL ||
    "https://discord.com/api/webhooks/1362420377506152529/he_-FXmdsR7CWFnMDMPMCyG6bJNMRaOzJ_J-IYY3aghUy-Iqt1Vifd0xuFXKKAYwIlgm";

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

    console.log("Discord webhook body:", JSON.stringify(discordBody, null, 2));
    console.log("Screenshot URL:", screenshotUrl);
    console.log(
      "Screenshot markdown:",
      `![${app.title || app.name}](${screenshotUrl})`,
    );

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordBody),
    });

    if (!response.ok) {
      throw new Error(
        `Discord webhook failed: ${response.status} ${response.statusText}`,
      );
    } else {
      console.log(
        `✅ Discord webhook sent successfully`,
        response.status,
        response.statusText,
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
    console.log(`🟦 Creating Bluesky session for ${env.BLUESKY_HANDLE}`);

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
    console.log(`✅ Bluesky session created for DID: ${session.did}`);

    // Step 2: Get screenshot from KV and upload as blob
    const screenshotKey = `${app.slug}-screenshot`;
    let thumbnailBlob = null;

    try {
      const screenshotData = await env.KV.get(screenshotKey, "arrayBuffer");
      if (screenshotData) {
        console.log(`🟦 Uploading screenshot as blob for ${app.slug}`);

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
          console.log(`✅ Screenshot blob uploaded successfully`);
        } else {
          console.warn(
            `⚠️ Failed to upload screenshot blob: ${blobResponse.status}`,
          );
        }
      } else {
        console.log(`📷 No screenshot found for ${app.slug}`);
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

    console.log(`🟦 Creating Bluesky post with embed:`, {
      text: post.text,
      length: post.text.length,
      hasThumb: !!thumbnailBlob,
    });

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

    const postResult = (await postResponse.json()) as {
      uri: string;
      cid: string;
    };
    console.log(`✅ Bluesky post created successfully:`, {
      uri: postResult.uri,
      cid: postResult.cid,
    });
  } catch (error) {
    console.error("Error posting to Bluesky:", error);
    throw error;
  }
}
