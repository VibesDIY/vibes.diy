import { ExportedHandler, MessageBatch } from "@cloudflare/workers-types";
import { AppContext, EventoSendProvider, HandleTriggerCtx, Result } from "@adviser/cement";
import { CFEnv } from "@vibes.diy/api-types";
import { vibesQueueEvento } from "./queue-evento.js";
import { QueueCtx } from "./queue-ctx.js";
import { toDBFlavour } from "@vibes.diy/api-sql";
import { ensureSuperThis } from "@fireproof/core-runtime";

class NoopQueueSendProvider implements EventoSendProvider<unknown, unknown, unknown> {
  async send<T>(_ctx: HandleTriggerCtx<unknown, unknown, unknown>, _data: unknown): Promise<Result<T>> {
    return Result.Ok();
  }
}

export default {
  async queue(batch: MessageBatch, env: CFEnv) {
    const sthis = ensureSuperThis();
    const qctx = new QueueCtx({
      sthis,
      cf: {
        BROWSER: env.BROWSER,
        D1: env.DB,
        FS_IDS_BUCKET: env.FS_IDS_BUCKET,
      },
      vibes: {
        env: {
          VIBES_DIY_PUBLIC_BASE_URL: env.VIBES_DIY_PUBLIC_BASE_URL,
          RESEND_API_KEY: env.RESEND_API_KEY,
          VIBES_DIY_FROM_EMAIL: env.VIBES_DIY_FROM_EMAIL,
          DB_FLAVOUR: toDBFlavour(env.DB_FLAVOUR),
          NEON_DATABASE_URL: env.NEON_DATABASE_URL,
          DISCORD_WEBHOOK_URL: env.DISCORD_WEBHOOK_URL,
          LLM_BACKEND_URL: env.LLM_BACKEND_URL,
          LLM_BACKEND_API_KEY: env.LLM_BACKEND_API_KEY,
          PRODIA_TOKEN: env.PRODIA_TOKEN,
        },
      },
    });
    const ctx = new AppContext().set("queueCtx", qctx);
    const send = new NoopQueueSendProvider();
    const evento = vibesQueueEvento();

    for (const message of batch.messages) {
      console.log("message", message);
      const rTrigger = await evento.trigger({ ctx, send, request: message.body });
      if (rTrigger.isErr()) {
        console.error("Failed to process queue message:", message.id, rTrigger.Err());
        message.retry();
      } else {
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<CFEnv>;
