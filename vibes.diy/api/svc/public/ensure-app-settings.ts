import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  ActiveEntry,
  ActiveEnv,
  ActiveModelSetting,
  ActiveTitle,
  isActiveTitle,
  isReqEnsureAppSettings,
  isReqEnsureAppSettingsAcl,
  isReqEnsureAppSettingsApp,
  isReqEnsureAppSettingsChat,
  isReqEnsureAppSettingsEnv,
  isReqEnsureAppSettingsTitle,
  MsgBase,
  ReqEnsureAppSettings,
  ReqEnsureAppSettingsAcl,
  ResEnsureAppSettings,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithOptionalAuth, optAuth } from "../check-auth.js";
import { sqlAppSettings, sqlAppSlugBinding, sqlUserSlugBinding } from "../sql/vibes-diy-api-schema.js";
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
      .innerJoin(sqlAppSlugBinding, eq(sqlAppSettings.appSlug, sqlAppSlugBinding.appSlug))
      .innerJoin(sqlUserSlugBinding, eq(sqlAppSettings.userSlug, sqlUserSlugBinding.userSlug))
      .where(and(...cond))
      .get()
  );
  if (rPrev.isErr()) {
    return Result.Err(rPrev);
  }
  if (!rPrev.Ok()) {
    return Result.Err(`no appsettings for `);
  }
  const record = rPrev.Ok();
  const now = new Date().toISOString();
  if (!record) {
    return Result.Ok({
      type: "vibes.diy.res-ensure-app-settings",
      userId: "------",
      appSlug: req.appSlug,
      ledger: req.appSlug,
      userSlug: req.userSlug,
      tenant: req.userSlug,
      error: "not-found",
      settings: buildEnsureEntryResult([]),
      updated: now,
      created: now,
    } satisfies ResEnsureAppSettings);
  }
  const prev = record.AppSettings;

  const settings = ActiveEntry.array()(prev?.settings || []);
  if (settings instanceof type.errors) {
    return Result.Err(settings.summary);
  }
  if (!userId) {
    return Result.Ok({
      type: "vibes.diy.res-ensure-app-settings",
      userId: record.AppSettings.userId,
      appSlug: req.appSlug,
      ledger: record.AppSlugBindings.ledger,
      userSlug: req.userSlug,
      tenant: record.UserSlugBindings.tenant,
      settings: buildEnsureEntryResult(settings),
      updated: prev.updated,
      created: prev.created,
    } satisfies ResEnsureAppSettings);
  }

  const res = {
    type: "vibes.diy.res-ensure-app-settings",
    userId,
    appSlug: req.appSlug,
    ledger: record.AppSlugBindings.ledger,
    userSlug: req.userSlug,
    tenant: record.UserSlugBindings.tenant,
    error: undefined as string | undefined,
    settings: buildEnsureEntryResult(settings),
    updated: prev?.updated ?? now,
    created: prev?.created ?? now,
  } satisfies ResEnsureAppSettings;

  switch (true) {
    case isReqEnsureAppSettingsAcl(req):
      await aclAction(vctx, req, res, settings);
      break;
    case isReqEnsureAppSettingsTitle(req):
      res.settings = upsert(
        settings,
        isActiveTitle,
        () =>
          ({
            type: "active.title",
            title: req.title,
          }) satisfies ActiveTitle
      );
      break;
    case isReqEnsureAppSettingsApp(req):
      res.settings = upsert(
        settings,
        isReqEnsureAppSettingsApp,
        (prev: ActiveModelSetting) =>
          ({
            type: "active.model",
            usage: "app",
            param: {
              ...prev.param,
              ...req,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsChat(req):
      res.settings = upsert(
        settings,
        isReqEnsureAppSettingsChat,
        (prev: ActiveModelSetting) =>
          ({
            type: "active.model",
            usage: "chat",
            param: {
              ...prev.param,
              ...req,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsEnv(req):
      res.settings = upsert(
        settings,
        isReqEnsureAppSettingsEnv,
        (prev: ActiveEnv) =>
          ({
            type: "active.env",
            env: {
              ...prev.env,
              ...req.env,
            },
          }) satisfies ActiveEnv
      );
      break;
  }
  return Result.Ok(res);
}

function upsert<T extends ActiveEntry, R extends ActiveEntry>(settings: T[], match: (e: unknown) => boolean, fn: (prev: R) => R) {
  const idx = settings.findIndex(match);
  if (idx >= 0) settings[idx] = fn(settings[idx] as unknown as R) as unknown as T;
  else settings.push(fn({} as unknown as R) as unknown as T);
  return buildEnsureEntryResult(settings);
}

async function aclAction(vctx: VibesApiSQLCtx, req: ReqEnsureAppSettingsAcl, res: ResEnsureAppSettings, settings: ActiveEntry[]) {
  const now = new Date().toISOString();
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
      res.error = rIns.Err().message;
    } else {
      await sendEmailOpts(vctx, result.Ok().emailOps);
    }
  }
}

export const ensureAppSettingsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqEnsureAppSettings>,
  ResEnsureAppSettings | VibesDiyError
> = {
  hash: "ensure-app-settings",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqEnsureAppSettings(msg.payload)) {
      return Result.Ok(
        Option.Some({
          ...msg,
          payload: msg.payload as ReqEnsureAppSettings,
        })
      );
    }
    return Result.Ok(Option.None());
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithOptionalAuth<ReqEnsureAppSettings>>,
        ResEnsureAppSettings | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rResult = await ensureAppSettings(vctx, req as unknown as ReqEnsureAppSettings, req.auth?.verifiedAuth.claims.userId);
      if (rResult.isErr()) {
        return Result.Err(rResult);
      }

      await ctx.send.send(ctx, rResult.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
