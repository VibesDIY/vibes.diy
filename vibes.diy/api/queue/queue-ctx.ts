import { exception2Result, Result } from "@adviser/cement";
import { EvtBackendOnChange, RawEmailWithoutFrom, S3Api } from "@vibes.diy/api-types";
import { D1Database, DurableObjectNamespace, Fetcher, R2Bucket } from "@cloudflare/workers-types";
import { createVibesApiTables, cfDrizzle, CreateSQLPeerParams, toDBFlavour, VibesApiTables } from "@vibes.diy/api-sql";
import { R2ToS3Api } from "@vibes.diy/api-svc";
import {
  backendDoName,
  BACKEND_OWNER_HEADER,
  BACKEND_SLUG_HEADER,
  BACKEND_OP_HEADER,
  BACKEND_OP_ARM,
  BACKEND_OP_ONCHANGE,
} from "@vibes.diy/api-svc/intern/backend-do-addr.js";
import { SuperThis } from "@vibes.diy/identity";

export interface QueueCtxParams {
  sthis: SuperThis;
  cf: {
    BROWSER: Fetcher;
    D1: D1Database;
    FS_IDS_BUCKET?: R2Bucket;
    USER_NOTIFY?: DurableObjectNamespace;
    BACKEND_DO?: DurableObjectNamespace;
  };
  vibes: {
    env: {
      VIBES_DIY_PUBLIC_BASE_URL: string;
      RESEND_API_KEY: string;
      VIBES_DIY_FROM_EMAIL: string;
      DB_FLAVOUR: string;
      NEON_DATABASE_URL?: string;
      DISCORD_WEBHOOK_URL?: string;
      LLM_BACKEND_URL: string;
      LLM_BACKEND_API_KEY: string;
      PRODIA_TOKEN?: string;
      ICON_FALLBACK_MODEL?: string;
    };
  };
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  image?: { url: string };
}

export interface DiscordWebhookBody {
  content?: string;
  embeds?: DiscordEmbed[];
}

export class QueueCtx {
  readonly sthis: SuperThis;
  readonly params: QueueCtxParams;
  readonly storageSystems: {
    sql: CreateSQLPeerParams;
    s3?: S3Api;
  };
  readonly sql: {
    db: ReturnType<typeof cfDrizzle>["db"];
    tables: VibesApiTables;
  };
  constructor(params: QueueCtxParams) {
    this.sthis = params.sthis;
    this.params = params;
    const { db } = cfDrizzle(this.params.vibes.env, this.params.cf.D1);
    const tables = createVibesApiTables(toDBFlavour(this.params.vibes.env.DB_FLAVOUR));

    this.sql = {
      db,
      tables,
    };
    this.storageSystems = {
      sql: {
        flavour: toDBFlavour(this.params.vibes.env.DB_FLAVOUR),
        db,
        assets: tables.assets,
      },
      s3: this.params.cf.FS_IDS_BUCKET ? new R2ToS3Api(this.params.cf.FS_IDS_BUCKET, this.sthis) : undefined,
    };
  }

  async postToDiscord(body: DiscordWebhookBody): Promise<Result<void>> {
    const webhookUrl = this.params.vibes.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl === undefined) {
      console.warn("DISCORD_WEBHOOK_URL not set — skipping Discord notification");
      return Result.Ok();
    }
    const rRes = await exception2Result(() =>
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    if (rRes.isErr()) {
      return Result.Err(rRes);
    }
    const res = rRes.Ok();
    if (!res.ok) {
      return Result.Err(`Discord webhook got an error: ${res.status}:${res.statusText}`);
    }
    return Result.Ok();
  }

  async sendEmail(rm: RawEmailWithoutFrom): Promise<Result<{ result: unknown }>> {
    const rRes = await exception2Result(() =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.params.vibes.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...rm,
          from: this.params.vibes.env.VIBES_DIY_FROM_EMAIL,
        }),
      })
    );
    if (rRes.isErr()) {
      return Result.Err(rRes);
    }
    const res = rRes.Ok();
    if (!res.ok) {
      return Result.Err(`Resend got an error: ${res.status}:${res.statusText}`);
    }
    const jsonTxt = await res.text();
    const rJson = exception2Result(() => JSON.parse(jsonTxt));
    return Result.Ok({ result: rJson.isOk() ? rJson.Ok() : jsonTxt });
  }

  /**
   * Poke a vibe's `BackendDO` to re-evaluate its `scheduled` alarm (#2856 B4).
   * Returns `Err` on a failed poke so the queue worker's `message.retry()` fires —
   * deliberately NOT the swallow-and-continue pattern `notifyUser` uses, or a poke
   * lost to a transient DO miss would leave the schedule stale (per Charlie). When
   * the binding is absent (unit tests / envs without the DO) it's a no-op, not an
   * error.
   */
  async armBackend(ownerHandle: string, appSlug: string): Promise<Result<void>> {
    const ns = this.params.cf?.BACKEND_DO;
    if (!ns) return Result.Ok();
    const stub = ns.get(ns.idFromName(backendDoName(ownerHandle, appSlug)));
    const rRes = await exception2Result(() =>
      stub.fetch(
        new Request("https://internal/__backend_arm", {
          method: "POST",
          headers: {
            [BACKEND_OWNER_HEADER]: ownerHandle,
            [BACKEND_SLUG_HEADER]: appSlug,
            [BACKEND_OP_HEADER]: BACKEND_OP_ARM,
          },
        }) as unknown as Parameters<typeof stub.fetch>[0]
      )
    );
    if (rRes.isErr()) return Result.Err(rRes);
    if (rRes.Ok().status >= 300) return Result.Err(`backend arm poke got ${rRes.Ok().status}`);
    return Result.Ok();
  }

  /**
   * Poke a vibe's `BackendDO` to run its `onChange` handler for one committed write
   * (#2856 B5). Like `armBackend`, returns `Err` on a failed poke so the queue
   * worker's `message.retry()` fires (at-least-once delivery); a no-op when the
   * binding is absent. The full document payload travels in the request body (too
   * big/structured for headers); the addressing headers route it to the vibe.
   */
  async invokeOnChange(payload: EvtBackendOnChange): Promise<Result<void>> {
    const ns = this.params.cf?.BACKEND_DO;
    if (!ns) return Result.Ok();
    const stub = ns.get(ns.idFromName(backendDoName(payload.ownerHandle, payload.appSlug)));
    const rRes = await exception2Result(() =>
      stub.fetch(
        new Request("https://internal/__backend_onchange", {
          method: "POST",
          headers: {
            [BACKEND_OWNER_HEADER]: payload.ownerHandle,
            [BACKEND_SLUG_HEADER]: payload.appSlug,
            [BACKEND_OP_HEADER]: BACKEND_OP_ONCHANGE,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            dbName: payload.dbName,
            docId: payload.docId,
            seq: payload.seq,
            deleted: payload.deleted,
            doc: payload.doc,
            oldDoc: payload.oldDoc ?? null,
            depth: payload.depth,
            writerUserId: payload.writerUserId ?? null,
          }),
        }) as unknown as Parameters<typeof stub.fetch>[0]
      )
    );
    if (rRes.isErr()) return Result.Err(rRes);
    if (rRes.Ok().status >= 300) return Result.Err(`backend onChange poke got ${rRes.Ok().status}`);
    return Result.Ok();
  }

  async notifyUser(
    userId: string,
    evt: {
      type: "vibes.diy.evt-user-notification";
      notificationType: string;
      ownerHandle: string;
      appSlug: string;
    }
  ): Promise<void> {
    const ns = this.params.cf?.USER_NOTIFY;
    if (!ns) return;
    try {
      const id = ns.idFromName(userId);
      const stub = ns.get(id);
      await stub.fetch(
        new Request("https://internal/user-notify", {
          method: "POST",
          body: JSON.stringify({
            action: "notify",
            targetUserId: userId,
            senderShardId: "queue",
            senderConnId: "queue",
            evt,
          }),
          headers: { "Content-Type": "application/json" },
        }) as unknown as Parameters<typeof stub.fetch>[0]
      );
    } catch (e: unknown) {
      console.error("[QueueCtx] notifyUser failed for userId:", userId.slice(0, 8), e);
    }
  }
}
