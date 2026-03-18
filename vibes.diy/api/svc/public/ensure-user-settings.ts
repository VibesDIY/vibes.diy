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
import { sqlUserSettings } from "../sql/vibes-diy-api-schema.js";
import { eq } from "drizzle-orm";

export async function ensureUserSettings(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureUserSettings>
): Promise<Result<ResEnsureUserSettings>> {
  const userId = req._auth.verifiedAuth.claims.userId;
  const existing = await vctx.db.select().from(sqlUserSettings).where(eq(sqlUserSettings.userId, userId)).get();
  const now = new Date().toISOString();
  if (!existing) {
    await vctx.db.insert(sqlUserSettings).values({
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
  await vctx.db
    .update(sqlUserSettings)
    .set({
      settings,
      updated: now,
    })
    .where(eq(sqlUserSettings.userId, userId))
    .run();

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
