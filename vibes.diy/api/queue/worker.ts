import { ExportedHandler, MessageBatch } from "@cloudflare/workers-types";
import { AppContext, EventoSendProvider, HandleTriggerCtx, Result, TriggerResult } from "@adviser/cement";
import { CFEnv } from "@vibes.diy/api-types";
import { vibesQueueEvento } from "./queue-evento.js";
import { QueueCtx } from "./queue-ctx.js";
import { toDBFlavour } from "@vibes.diy/api-sql";
import { ensureSuperThis } from "@vibes.diy/identity";

class NoopQueueSendProvider implements EventoSendProvider<unknown, unknown, unknown> {
  async send<T>(_ctx: HandleTriggerCtx<unknown, unknown, unknown>, _data: unknown): Promise<Result<T>> {
    return Result.Ok();
  }
}

/**
 * Decide whether a queue message should be retried after `evento.trigger`.
 *
 * The pinned `@adviser/cement` `Evento.trigger` records a handler's returned
 * `Err` in `stepCtx.error`, runs the `EventoType.Error` handlers, and then still
 * returns `Result.Ok(stepCtx)`. So a handler `Err` (e.g. a failed BackendDO
 * `/arm` poke) does NOT surface as `rTrigger.isErr()` — it surfaces as
 * `rTrigger.Ok().error` being set. Retry on either signal; ack only when the
 * trigger is Ok *and* carries no recorded error.
 */
export function shouldRetryTrigger(rTrigger: Result<TriggerResult<unknown, unknown, unknown>>): boolean {
  if (rTrigger.isErr()) {
    return true;
  }
  return rTrigger.Ok().error !== undefined;
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
        USER_NOTIFY: env.USER_NOTIFY,
        BACKEND_DO: env.BACKEND_DO,
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
          ICON_FALLBACK_MODEL: env.ICON_FALLBACK_MODEL,
        },
      },
    });
    const ctx = new AppContext().set("queueCtx", qctx);
    const send = new NoopQueueSendProvider();
    const evento = vibesQueueEvento();

    for (const message of batch.messages) {
      console.info("message", message);
      const rTrigger = await evento.trigger({ ctx, send, request: message.body });
      if (shouldRetryTrigger(rTrigger)) {
        const err = rTrigger.isErr() ? rTrigger.Err() : rTrigger.Ok().error;
        console.error("Failed to process queue message:", message.id, err);
        message.retry();
      } else {
        message.ack();
      }
    }
  },
} satisfies ExportedHandler<CFEnv>;
