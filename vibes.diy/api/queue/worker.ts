import { ExportedHandler, MessageBatch } from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";
import { processScreenShotEvent } from "./screen-shotter.js";

export default {
  async queue(batch: MessageBatch, env: CFEnv) {
    for (const message of batch.messages) {
      try {
        console.log("Queue message received:", message.id, typeof message.body);
        let body = message.body;
        if (typeof message.body === "string") {
          body = JSON.parse(message.body as string);
          console.log("Message body:", body);
        }
        await processScreenShotEvent(body, env);
        message.ack();
      } catch (error) {
        console.error("Failed to process queue message:", error);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CFEnv>;
