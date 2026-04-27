import { EventoHandler, EventoResult, EventoResultType, HandleTriggerCtx, Option, Result, exception2Result, uint8array2stream } from "@adviser/cement";
import {
  ActiveEntry,
  ActiveIcon,
  EvtIconRepair,
  EvtNewFsId,
  MsgBase,
  isActiveIcon,
  isActiveTitle,
  isEvtIconRepair,
  isEvtNewFsId,
  msgBase,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { createSQLPeer } from "@vibes.diy/api-sql";
import { ensureStorage } from "@vibes.diy/api-pkg";
import { ensureLogger } from "@fireproof/core-runtime";
import { type } from "arktype";
import { and, eq } from "drizzle-orm/sql/expressions";
import { QueueCtx } from "../queue-ctx.js";
import { generateIcon } from "../intern/generate-icon.js";

type IconEvt = EvtNewFsId | EvtIconRepair;

export const evtIconGenEvento: EventoHandler<unknown, MsgBase<IconEvt>, void> = {
  hash: "evt-icon-gen",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtNewFsId(msg.payload) && !isEvtIconRepair(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<IconEvt>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<IconEvt>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const { userSlug, appSlug } = ctx.validated.payload;
    const logger = ensureLogger(qctx.sthis, "evtIconGen");

    const rUserId = await resolveUserId(qctx, userSlug);
    if (rUserId.isErr()) {
      logger.Warn().Any({ userSlug, err: rUserId.Err() }).Msg("skip icon-gen: userId not found for userSlug");
      return Result.Ok(EventoResult.Continue);
    }
    const userId = rUserId.Ok();

    const rRow = await exception2Result(() =>
      qctx.sql.db
        .select()
        .from(qctx.sql.tables.appSettings)
        .where(
          and(
            eq(qctx.sql.tables.appSettings.userId, userId),
            eq(qctx.sql.tables.appSettings.userSlug, userSlug),
            eq(qctx.sql.tables.appSettings.appSlug, appSlug)
          )
        )
        .limit(1)
        .then((r) => r[0])
    );
    if (rRow.isErr()) return Result.Err(`appSettings read failed: ${rRow.Err()}`);
    const row = rRow.Ok();

    const { filtered: entries } = parseArrayWarning((row?.settings as unknown[]) ?? [], ActiveEntry);
    if (entries.find(isActiveIcon)) {
      return Result.Ok(EventoResult.Continue);
    }

    const titleEntry = entries.find(isActiveTitle);
    const category = titleEntry?.title ?? appSlug;

    const rGen = await generateIcon({
      category,
      llmUrl: qctx.params.vibes.env.LLM_BACKEND_URL,
      llmApiKey: qctx.params.vibes.env.LLM_BACKEND_API_KEY,
    });
    if (rGen.isErr()) {
      logger.Error().Any({ err: rGen.Err(), userSlug, appSlug, category }).Msg("icon-gen failed");
      return Result.Err(rGen.Err());
    }
    const { bytes, mime } = rGen.Ok();

    const [storageResult] = await ensureStorage(createSQLPeer(qctx.storageSystems.sql)).ensure(uint8array2stream(bytes));
    if (!storageResult || storageResult.isErr()) {
      return Result.Err(`icon-gen storage.ensure failed: ${storageResult?.Err()}`);
    }
    const cid = storageResult.Ok().getURL;

    const iconEntry: ActiveIcon = { type: "active.icon", cid, mime };
    const nextEntries: ActiveEntry[] = [...entries.filter((e) => !isActiveIcon(e)), iconEntry];

    const now = new Date().toISOString();
    const rUp = await exception2Result(() =>
      qctx.sql.db
        .insert(qctx.sql.tables.appSettings)
        .values({
          userId,
          userSlug,
          appSlug,
          settings: nextEntries,
          updated: now,
          created: row?.created ?? now,
        })
        .onConflictDoUpdate({
          target: [qctx.sql.tables.appSettings.userId, qctx.sql.tables.appSettings.userSlug, qctx.sql.tables.appSettings.appSlug],
          set: { settings: nextEntries, updated: now },
        })
    );
    if (rUp.isErr()) {
      logger.Error().Any({ err: rUp.Err(), userSlug, appSlug }).Msg("icon-gen appSettings upsert failed");
      return Result.Err(`icon-gen upsert failed: ${rUp.Err()}`);
    }

    logger.Info().Any({ userSlug, appSlug, category, cid }).Msg("icon-gen complete");
    return Result.Ok(EventoResult.Continue);
  },
};

async function resolveUserId(qctx: QueueCtx, userSlug: string): Promise<Result<string>> {
  const rBinding = await exception2Result(() =>
    qctx.sql.db
      .select({ userId: qctx.sql.tables.userSlugBinding.userId })
      .from(qctx.sql.tables.userSlugBinding)
      .where(eq(qctx.sql.tables.userSlugBinding.userSlug, userSlug))
      .limit(1)
      .then((r) => r[0])
  );
  if (rBinding.isErr()) return Result.Err(rBinding);
  const row = rBinding.Ok();
  if (!row) return Result.Err(`no userSlugBinding for ${userSlug}`);
  return Result.Ok(row.userId);
}

