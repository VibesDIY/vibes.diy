import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqEnsureUserSettings,
  ReqEnsureUserSettings,
  ReqWithVerifiedAuth,
  ResEnsureUserSettings,
  userSettingItem,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq } from "drizzle-orm/sql/expressions";

export async function ensureUserSettings(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureUserSettings>
): Promise<Result<ResEnsureUserSettings>> {
  const userId = req._auth.verifiedAuth.claims.userId;
  const existing = await vctx.sql.db
    .select()
    .from(vctx.sql.tables.userSettings)
    .where(eq(vctx.sql.tables.userSettings.userId, userId))
    .limit(1)
    .then((r) => r[0]);
  const now = new Date().toISOString();
  if (!existing) {
    await vctx.sql.db.insert(vctx.sql.tables.userSettings).values({
      userId,
      settings: [],
      updated: now,
      created: now,
    });
    return ensureUserSettings(vctx, req);
  }
  const settingsArray = userSettingItem.array()(existing.settings);
  if (settingsArray instanceof type.errors) {
    return Result.Err(`Failed to parse existing user settings: ${settingsArray.summary}`);
  }
  const settingsSet = new Map([...settingsArray, ...req.settings].map((item) => [item.type, item]));
  const settings = userSettingItem.array()(Array.from(settingsSet.values()));
  if (settings instanceof type.errors) {
    return Result.Err(`Failed to parse merged user settings: ${settings.summary}`);
  }
  await vctx.sql.db
    .update(vctx.sql.tables.userSettings)
    .set({
      settings,
      updated: now,
    })
    .where(eq(vctx.sql.tables.userSettings.userId, userId));

  return Result.Ok({
    type: "vibes.diy.res-ensure-user-settings",
    userId,
    settings,
    updated: now,
    created: existing.created,
  });
}

export const ensureUserSettingsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqEnsureUserSettings>,
  ResEnsureUserSettings | VibesDiyError
> = {
  hash: "ensure-user-settings",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqEnsureUserSettings(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqEnsureUserSettings>>,
        ResEnsureUserSettings | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rResult = await ensureUserSettings(vctx, req);
      if (rResult.isErr()) {
        return Result.Err(rResult);
      }

      await ctx.send.send(ctx, rResult.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
