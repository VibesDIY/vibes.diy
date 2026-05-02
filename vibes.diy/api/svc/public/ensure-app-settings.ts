import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  ActiveDbAcl,
  ActiveEntry,
  ActiveIconDescription,
  parseArrayWarning,
  ActiveEnv,
  ActiveModelSetting,
  ActiveSkills,
  ActiveTitle,
  AppSettings,
  EnablePublicAccess,
  EnableRequest,
  EvtAppSetting,
  EvtIconGen,
  isActiveDbAcl,
  isActiveEnv,
  isActiveIcon,
  isActiveIconDescription,
  isActiveModelSettingApp,
  isActiveModelSettingChat,
  isActiveModelSettingImg,
  isActiveSkills,
  isReqEnsureAppSettingsIconDescription,
  isReqEnsureAppSettingsIconRegen,
  isReqEnsureAppSettingsImg,
  isReqEnsureAppSettingsSkills,
  isActiveTitle,
  isEnablePublicAccess,
  isEnableRequest,
  isReqEnsureAppSettings,
  isReqEnsureAppSettingsApp,
  isReqEnsureAppSettingsChat,
  isReqEnsureAppSettingsDbAcl,
  isReqEnsureAppSettingsDbAclRemove,
  isReqEnsureAppSettingsEnv,
  isReqEnsureAppSettingsTitle,
  isReqPublicAccess,
  isReqRequest,
  MsgBase,
  ReqEnsureAppSettings,
  ReqWithOptionalAuth,
  ResEnsureAppSettings,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { eq, and } from "drizzle-orm/sql/expressions";
import { getModelDefaults } from "../intern/get-model-defaults.js";
import { approveAllPendingRequests } from "./request-flow.js";
// import { buildEnsureEntryResult } from "../intern/application-settings.js";

export function buildEnsureEntryResult(entries: ActiveEntry[]): AppSettings {
  // just collect and assign to the right buckets
  const result: AppSettings = {
    entries,
    entry: {
      settings: {
        env: [],
      },
      // request: {
      //   pending: [],
      //   approved: [],
      //   rejected: [],
      // },
      // invite: {
      //   viewers: {
      //     pending: [],
      //     accepted: [],
      //     revoked: [],
      //   },
      //   editors: {
      //     pending: [],
      //     accepted: [],
      //     revoked: [],
      //   },
      // },
    },
  };
  entries.forEach((e) => {
    // const x = EnableRequest(e)
    // if (x instanceof type.errors) {
    //   // console.log(`Processing entry:`, e, x.summary);
    // }
    switch (true) {
      case isEnablePublicAccess(e):
        result.entry.publicAccess = e;
        break;
      case isEnableRequest(e):
        result.entry.enableRequest = e;
        break;
      case isActiveTitle(e):
        result.entry.settings.title = e.title;
        break;
      case isActiveSkills(e):
        result.entry.settings.skills = e.skills;
        break;
      case isActiveIconDescription(e):
        result.entry.settings.iconDescription = e.description;
        break;
      case isActiveIcon(e): {
        const head = e.versions.find((v) => v.cid === e.currentCid);
        if (head && head.cid.length > 0) {
          result.entry.settings.icon = { cid: head.cid, mime: head.mime };
        }
        break;
      }
      case isActiveModelSettingChat(e):
        result.entry.settings.chat = e.param;
        break;
      case isActiveModelSettingApp(e):
        result.entry.settings.app = e.param;
        break;
      case isActiveModelSettingImg(e):
        result.entry.settings.img = e.param;
        break;
      case isActiveEnv(e):
        result.entry.settings.env.push(...e.env);
        break;
      case isActiveDbAcl(e):
        result.entry.dbAcls = result.entry.dbAcls ?? {};
        result.entry.dbAcls[e.dbName] = e.acl;
        break;
    }
  });
  return result;
}

async function withModelDefaults(vctx: VibesApiSQLCtx, res: ResEnsureAppSettings): Promise<ResEnsureAppSettings> {
  const rDefaults = await getModelDefaults(vctx, { appSlug: res.appSlug, userSlug: res.userSlug });
  if (rDefaults.isErr()) return res;
  const defaults = rDefaults.Ok();
  const s = res.settings.entry.settings;
  if (!s.chat) s.chat = defaults.chat;
  if (!s.app) s.app = defaults.app;
  if (!s.img) s.img = defaults.img;
  return res;
}

async function postIconGen(
  vctx: VibesApiSQLCtx,
  args: { userSlug: string; appSlug: string; force: boolean }
): Promise<void> {
  await vctx.postQueue({
    payload: {
      type: "vibes.diy.evt-icon-gen",
      userSlug: args.userSlug,
      appSlug: args.appSlug,
      ...(args.force ? { force: true } : {}),
    },
    tid: "queue-event",
    src: "ensureAppSettings",
    dst: "vibes-service",
    ttl: 1,
  } satisfies MsgBase<EvtIconGen>);
}

const ICON_REGEN_MIN_INTERVAL_MS = 10_000;

// True if an ActiveIcon's head version was created within the last
// ICON_REGEN_MIN_INTERVAL_MS — used to soft-no-op rapid Regenerate clicks.
function recentlyRegenerated(entries: ActiveEntry[]): boolean {
  const icon = entries.find(isActiveIcon);
  if (!icon) return false;
  const head = icon.versions.find((v) => v.cid === icon.currentCid);
  if (!head) return false;
  const headCreated = Date.parse(head.created);
  if (Number.isNaN(headCreated)) return false;
  return Date.now() - headCreated < ICON_REGEN_MIN_INTERVAL_MS;
}

export async function ensureAppSettings(
  vctx: VibesApiSQLCtx,
  req: ReqEnsureAppSettings,
  userId?: string
): Promise<Result<ResEnsureAppSettings>> {
  // find existing app settings
  const rPrev = await exception2Result(() =>
    vctx.sql.db
      .select()
      .from(vctx.sql.tables.userSlugBinding)
      .innerJoin(
        vctx.sql.tables.appSlugBinding,
        eq(vctx.sql.tables.appSlugBinding.userSlug, vctx.sql.tables.userSlugBinding.userSlug)
      )
      .leftJoin(
        vctx.sql.tables.appSettings,
        and(
          eq(vctx.sql.tables.appSettings.userId, vctx.sql.tables.userSlugBinding.userId),
          eq(vctx.sql.tables.appSettings.appSlug, req.appSlug),
          eq(vctx.sql.tables.appSettings.userSlug, vctx.sql.tables.userSlugBinding.userSlug)
        )
      )
      .where(
        and(eq(vctx.sql.tables.appSlugBinding.userSlug, req.userSlug), eq(vctx.sql.tables.appSlugBinding.appSlug, req.appSlug))
      )
      .limit(1)
      .then((r) => r[0])
  );
  if (rPrev.isErr()) {
    return Result.Err(rPrev);
  }
  const record = rPrev.Ok();
  const now = new Date().toISOString();

  if (!userId || userId !== record?.UserSlugBindings.userId) {
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
    const { filtered: settings, warning: settingsWarning } = parseArrayWarning(record.AppSettings?.settings || [], ActiveEntry);
    if (settingsWarning.length > 0) {
      ensureLogger(vctx.sthis, "ensureAppSettings").Warn().Any({ parseErrors: settingsWarning }).Msg("skip");
    }
    return Result.Ok(
      await withModelDefaults(vctx, {
        type: "vibes.diy.res-ensure-app-settings",
        userId: record.UserSlugBindings.userId,
        appSlug: req.appSlug,
        ledger: record.AppSlugBindings.ledger,
        userSlug: req.userSlug,
        tenant: record.UserSlugBindings.tenant,
        settings: buildEnsureEntryResult(settings || []),
        updated: record.AppSettings?.updated ?? now,
        created: record.AppSettings?.created ?? now,
      } satisfies ResEnsureAppSettings)
    );
  }
  record.AppSettings = record.AppSettings ?? {
    settings: [],
    updated: now,
    created: now,
    userId: record.UserSlugBindings.userId,
    userSlug: record.UserSlugBindings.userSlug,
    appSlug: record.AppSlugBindings.appSlug,
  };

  const { filtered: settings, warning: settingsWarning2 } = parseArrayWarning(record.AppSettings.settings || [], ActiveEntry);
  if (settingsWarning2.length > 0) {
    ensureLogger(vctx.sthis, "ensureAppSettings").Warn().Any({ parseErrors: settingsWarning2 }).Msg("skip");
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
    updated: now,
    created: record.AppSettings.created,
  } satisfies ResEnsureAppSettings;
  switch (true) {
    // case isReqEnsureAppSettingsAcl(req):
    // await aclAction(vctx, req, res, settings);
    // break;

    case isReqPublicAccess(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isEnablePublicAccess,
        () =>
          ({
            type: "app.public.access",
            enable: req.publicAccess.enable,
          }) satisfies EnablePublicAccess
      );
      break;

    case isReqRequest(req): {
      const prevAutoAcceptRole = settings.find(isEnableRequest)?.autoAcceptRole;
      const nextAutoAcceptRole = req.request.autoAcceptRole;

      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isEnableRequest,
        () =>
          ({
            type: "app.request",
            enable: req.request.enable,
            autoAcceptRole: req.request.autoAcceptRole,
          }) satisfies EnableRequest
      );

      if (!res.error && !prevAutoAcceptRole && nextAutoAcceptRole) {
        const drained = await approveAllPendingRequests(
          vctx,
          {
            userId: res.userId,
            appSlug: res.appSlug,
            userSlug: res.userSlug,
          },
          nextAutoAcceptRole
        );
        if (drained.isErr()) {
          res.error = drained.Err().message;
        }
      }
      break;
    }

    case isReqEnsureAppSettingsTitle(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveTitle,
        () =>
          ({
            type: "active.title",
            title: req.title,
          }) satisfies ActiveTitle
      );
      break;
    case isReqEnsureAppSettingsIconDescription(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveIconDescription,
        () =>
          ({
            type: "active.icon-description",
            description: req.iconDescription,
          }) satisfies ActiveIconDescription
      );
      if (!res.error) {
        await postIconGen(vctx, { userSlug: res.userSlug, appSlug: res.appSlug, force: false });
      }
      break;
    case isReqEnsureAppSettingsIconRegen(req):
      // No entry mutation — pure regen request. Rate-limit on the head
      // version's `created` to bound double-click cost.
      if (!recentlyRegenerated(settings)) {
        await postIconGen(vctx, { userSlug: res.userSlug, appSlug: res.appSlug, force: true });
      }
      break;
    case isReqEnsureAppSettingsSkills(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveSkills,
        () =>
          ({
            type: "active.skills",
            skills: req.skills,
          }) satisfies ActiveSkills
      );
      break;
    case isReqEnsureAppSettingsApp(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveModelSettingApp,
        (prev: ActiveModelSetting) =>
          ({
            type: "active.model",
            usage: "app",
            param: {
              ...prev.param,
              ...req.app,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsChat(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveModelSettingChat,
        (prev: ActiveModelSetting) =>
          ({
            type: "active.model",
            usage: "chat",
            param: {
              ...prev.param,
              ...req.chat,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsImg(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveModelSettingImg,
        (prev: ActiveModelSetting) =>
          ({
            type: "active.model",
            usage: "img",
            param: {
              ...prev.param,
              ...req.img,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsEnv(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveEnv,
        (_prev: ActiveEnv) =>
          ({
            type: "active.env",
            env: [
              // ...prev.env,
              ...req.env,
            ],
          }) satisfies ActiveEnv
      );
      break;
    case isReqEnsureAppSettingsDbAcl(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        // Match per-(dbName) rather than the first ActiveDbAcl entry —
        // each dbName gets its own row in the entries array.
        (e) => isActiveDbAcl(e) && e.dbName === req.dbAcl.dbName,
        () =>
          ({
            type: "active.db-acl",
            dbName: req.dbAcl.dbName,
            acl: req.dbAcl.acl,
          }) satisfies ActiveDbAcl
      );
      break;
    case isReqEnsureAppSettingsDbAclRemove(req):
      [res.settings, res.error] = await sqlRemove(
        vctx,
        res,
        settings,
        (e) => isActiveDbAcl(e) && e.dbName === req.dbAclRemove.dbName
      );
      break;
  }
  return Result.Ok(await withModelDefaults(vctx, res));
}

function upsert<T extends ActiveEntry, R extends ActiveEntry>(settings: T[], match: (e: unknown) => boolean, fn: (prev: R) => R) {
  const idx = settings.findIndex(match);
  if (idx >= 0) settings[idx] = fn(settings[idx] as unknown as R) as unknown as T;
  else settings.push(fn({} as unknown as R) as unknown as T);
  // console.log(">>>>", settings, idx, settings[idx]);
  return buildEnsureEntryResult(settings);
}

async function sqlUpsert<T extends ActiveEntry, R extends ActiveEntry>(
  vctx: VibesApiSQLCtx,
  res: ResEnsureAppSettings,
  settings: T[],
  match: (e: unknown) => boolean,
  fn: (prev: R) => R
): Promise<[AppSettings, string?]> {
  const entry = upsert(settings, match, fn);
  const ret = await sqlUpdateSettings(vctx, res, entry.entries);
  if (ret.isErr()) {
    return [entry, ret.Err().message];
  }
  return [entry];
}

async function sqlRemove<T extends ActiveEntry>(
  vctx: VibesApiSQLCtx,
  res: ResEnsureAppSettings,
  settings: T[],
  match: (e: unknown) => boolean
): Promise<[AppSettings, string?]> {
  // Mutate in place so res.settings.entries (same reference) reflects the
  // removal — sqlUpdateSettings's conflict path writes res.settings.entries.
  for (let i = settings.length - 1; i >= 0; i--) {
    if (match(settings[i])) settings.splice(i, 1);
  }
  const entry = buildEnsureEntryResult(settings);
  const ret = await sqlUpdateSettings(vctx, res, entry.entries);
  if (ret.isErr()) {
    return [entry, ret.Err().message];
  }
  return [entry];
}

async function sqlUpdateSettings(vctx: VibesApiSQLCtx, res: ResEnsureAppSettings, settings: ActiveEntry[]): Promise<Result<void>> {
  const now = new Date().toISOString();
  const rIns = await exception2Result(() =>
    vctx.sql.db
      .insert(vctx.sql.tables.appSettings)
      .values({
        userId: res.userId,
        appSlug: res.appSlug,
        userSlug: res.userSlug,
        settings,
        updated: now,
        created: res.created,
      })
      .onConflictDoUpdate({
        target: [vctx.sql.tables.appSettings.userId, vctx.sql.tables.appSettings.userSlug, vctx.sql.tables.appSettings.appSlug],
        set: {
          settings: res.settings.entries,
          updated: now,
        },
      })
  );
  await vctx.postQueue({
    payload: {
      type: "vibes.diy.evt-app-setting",
      userSlug: res.userSlug,
      appSlug: res.appSlug,
      settings,
    },
    tid: "queue-event",
    src: "ensureAppSettings",
    dst: "vibes-service",
    ttl: 1,
  } satisfies MsgBase<EvtAppSetting>);

  return rIns;
}

// async function aclAction(vctx: VibesApiSQLCtx, req: ReqEnsureAppSettingsAcl, res: ResEnsureAppSettings, settings: ActiveEntry[]) {
//   const result = await ensureACLEntry({
//     vctx,
//     userId: res.userId,
//     activeEntries: settings.filter((e) => isActiveAcl(e)),
//     crud: req.aclEntry.op === "delete" ? "delete" : "upsert",
//     // entry: req.aclEntry.entry,
//     appSlug: res.appSlug,
//     userSlug: res.userSlug,
//     token: () => vctx.sthis.nextId(128 / 8).str,
//   });
//   if (result.isErr()) {
//     res.error = result.Err().message;
//   } else {
//     // res.settings = result.Ok().appSettings;
//     // const rIns = await sqlUpdateSettings(vctx, res, result.Ok().appSettings.entries);
//     // // console.log(`ACL action SQL update result:`, rIns, result.Ok().appSettings.entries, settings, req.aclEntry);
//     // if (rIns.isErr()) {
//     //   res.error = rIns.Err().message;
//     // } else {
//     await sendEmailOpts(vctx, result.Ok().emailOps);
//     // }
//   }
// }

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

      const rResult = await ensureAppSettings(vctx, req as unknown as ReqEnsureAppSettings, req._auth?.verifiedAuth.claims.userId);
      // console.log(`ensureAppSettings result:`, req, JSON.stringify(rResult, null, 2));
      if (rResult.isErr()) {
        return Result.Err(rResult);
      }

      await ctx.send.send(ctx, rResult.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
