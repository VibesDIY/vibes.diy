import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  ActiveAclEntry,
  MsgBase,
  reqEnsureAppSettings,
  ReqEnsureAppSettings,
  ResEnsureAppSettings,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithVerifiedAuth, checkAuth } from "../check-auth.js";
import { sqlAppSettings } from "../sql/vibes-diy-api-schema.js";
import { eq, and } from "drizzle-orm";
import { buildEnsureEntryResult, ensureACLEntry } from "../intern/application-settings.js";
import { sendEmailOpts } from "../intern/send-email.js";

export async function ensureAppSettings(
  vctx: VibesApiSQLCtx,
  req: ReqEnsureAppSettings,
  userId?: string
): Promise<Result<ResEnsureAppSettings>> {
  const cond = [eq(sqlAppSettings.userSlug, req.userSlug), eq(sqlAppSettings.appSlug, req.appSlug)];
  if (userId) {
    cond.push(eq(sqlAppSettings.userId, userId));
  }
  const rPrev = await exception2Result(() =>
    vctx.db
      .select()
      .from(sqlAppSettings)
      .where(and(...cond))
      .get()
  );
  if (rPrev.isErr()) {
    return Result.Err(rPrev);
  }
  const prev = rPrev.Ok();
  const now = new Date().toISOString();
  if (!prev) {
    return Result.Ok({
      type: "vibes.diy.res-ensure-app-settings",
      userId: "------",
      appSlug: req.appSlug,
      userSlug: req.userSlug,
      error: "not-found",
      settings: buildEnsureEntryResult([]),
      updated: now,
      created: now,
    } satisfies ResEnsureAppSettings);
  }

  const settings = ActiveAclEntry.array()(prev?.settings || []);
  if (settings instanceof type.errors) {
    return Result.Err(settings.summary);
  }
  if (!userId) {
    return Result.Ok({
      type: "vibes.diy.res-ensure-app-settings",
      userId: "------",
      appSlug: req.appSlug,
      userSlug: req.userSlug,
      settings: buildEnsureEntryResult(settings),
      updated: prev.updated,
      created: prev.created,
    } satisfies ResEnsureAppSettings);
  }

  const res = {
    type: "vibes.diy.res-ensure-app-settings",
    userId,
    appSlug: req.appSlug,
    userSlug: req.userSlug,
    error: undefined as string | undefined,
    settings: buildEnsureEntryResult(settings),
    updated: prev?.updated ?? now,
    created: prev?.created ?? now,
  } satisfies ResEnsureAppSettings;

  if (!req.aclEntry) {
    return Result.Ok(res);
  }

  const result = ensureACLEntry({
    activeEntries: settings,
    crud: req.aclEntry.op === "delete" ? "delete" : "upsert",
    entry: req.aclEntry.entry,
    appSlug: res.appSlug,
    userSlug: res.userSlug,
    token: () => vctx.sthis.nextId(128 / 8).str,
  });
  if (result.isErr()) {
    res.error = result.Err().message;
  } else {
    res.settings = result.Ok().appSettings;
    const rIns = await exception2Result(() =>
      vctx.db
        .insert(sqlAppSettings)
        .values({
          userId: res.userId,
          appSlug: res.appSlug,
          userSlug: res.userSlug,
          settings: res.settings.entries,
          updated: now,
          created: now,
        })
        .onConflictDoUpdate({
          target: [sqlAppSettings.userId, sqlAppSettings.userSlug, sqlAppSettings.appSlug],
          set: {
            settings: res.settings.entries,
            updated: now,
          },
        })
    );
    if (rIns.isErr()) {
      return Result.Err(rIns);
    }
    await sendEmailOpts(vctx, result.Ok().emailOps);
  }
  return Result.Ok(res);
}

export const ensureAppSettingsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqEnsureAppSettings>,
  ResEnsureAppSettings | VibesDiyError
> = {
  hash: "ensure-app-settings",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqEnsureAppSettings(msg.payload);
    if (ret instanceof type.errors) {
      if ((msg.payload as { type: string }).type === "vibes.diy.req-ensure-app-settings") {
        console.log(`ensure-app-settings`, msg.payload, ret.summary);
      }
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
        MsgBase<ReqWithVerifiedAuth<ReqEnsureAppSettings>>,
        ResEnsureAppSettings | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rResult = await ensureAppSettings(vctx, req as unknown as ReqEnsureAppSettings, req.auth.verifiedAuth.claims.userId);
      if (rResult.isErr()) {
        return Result.Err(rResult);
      }

      await ctx.send.send(ctx, rResult.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
