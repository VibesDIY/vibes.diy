import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  ActiveDbAcl,
  ActiveEntry,
  ActiveIconDescription,
  parseArrayWarning,
  ActiveEnv,
  ActiveModelSetting,
  ActiveSkills,
  ActiveTheme,
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
  isActiveTheme,
  isReqEnsureAppSettingsIconDescription,
  isReqEnsureAppSettingsIconRegen,
  isReqEnsureAppSettingsImg,
  isReqEnsureAppSettingsSkills,
  isReqEnsureAppSettingsTheme,
  isActiveTitle,
  isEnablePublicAccess,
  isEnableRequest,
  isReqEnsureAppSettings,
  isReqEnsureAppSettingsApp,
  isReqEnsureAppSettingsAppSlug,
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
import { toRFC2822_32ByteLength } from "../intern/ensure-slug-binding.js";
import { resolveCanonicalAppSlug } from "../intern/resolve-app-slug.js";
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
      case isActiveTheme(e):
        result.entry.settings.theme = e.theme;
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

async function postIconGen(vctx: VibesApiSQLCtx, args: { userSlug: string; appSlug: string; force: boolean }): Promise<void> {
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

async function renameAppSlug(
  vctx: VibesApiSQLCtx,
  args: {
    userSlug: string;
    fromAppSlug: string;
    requestedNextAppSlug: string;
  }
): Promise<Result<{ appSlug: string }>> {
  const nextAppSlug = toRFC2822_32ByteLength(args.requestedNextAppSlug);
  if (!nextAppSlug) {
    return Result.Err("Invalid app slug — use letters, numbers, and hyphens (max 32 chars)");
  }
  if (nextAppSlug === args.fromAppSlug) {
    return Result.Ok({ appSlug: nextAppSlug });
  }

  const now = new Date().toISOString();
  const rRename = await exception2Result(() =>
    vctx.sql.db.transaction(async (tx) => {
      const existingCurrent = await tx
        .select({ appSlug: vctx.sql.tables.appSlugBinding.appSlug })
        .from(vctx.sql.tables.appSlugBinding)
        .where(
          and(
            eq(vctx.sql.tables.appSlugBinding.userSlug, args.userSlug),
            eq(vctx.sql.tables.appSlugBinding.appSlug, args.fromAppSlug)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      if (!existingCurrent) {
        throw new Error(`appSlug "${args.fromAppSlug}" not found`);
      }

      const existingTarget = await tx
        .select({ appSlug: vctx.sql.tables.appSlugBinding.appSlug })
        .from(vctx.sql.tables.appSlugBinding)
        .where(
          and(eq(vctx.sql.tables.appSlugBinding.userSlug, args.userSlug), eq(vctx.sql.tables.appSlugBinding.appSlug, nextAppSlug))
        )
        .limit(1)
        .then((r) => r[0]);
      if (existingTarget) {
        throw new Error(`Slug "${nextAppSlug}" is already taken`);
      }

      await tx
        .update(vctx.sql.tables.appSlugBinding)
        .set({
          appSlug: nextAppSlug,
          updated: now,
        })
        .where(
          and(
            eq(vctx.sql.tables.appSlugBinding.userSlug, args.userSlug),
            eq(vctx.sql.tables.appSlugBinding.appSlug, args.fromAppSlug)
          )
        );

      await tx
        .update(vctx.sql.tables.appSlugAlias)
        .set({
          appSlug: nextAppSlug,
          updated: now,
        })
        .where(
          and(eq(vctx.sql.tables.appSlugAlias.userSlug, args.userSlug), eq(vctx.sql.tables.appSlugAlias.appSlug, args.fromAppSlug))
        );

      await tx
        .insert(vctx.sql.tables.appSlugAlias)
        .values({
          userSlug: args.userSlug,
          aliasSlug: args.fromAppSlug,
          appSlug: nextAppSlug,
          created: now,
          updated: now,
        })
        .onConflictDoUpdate({
          target: [vctx.sql.tables.appSlugAlias.userSlug, vctx.sql.tables.appSlugAlias.aliasSlug],
          set: {
            appSlug: nextAppSlug,
            updated: now,
          },
        });

      // If this slug was previously an alias, remove that stale alias row now
      // that it is canonical again.
      await tx
        .delete(vctx.sql.tables.appSlugAlias)
        .where(
          and(
            eq(vctx.sql.tables.appSlugAlias.userSlug, args.userSlug),
            eq(vctx.sql.tables.appSlugAlias.aliasSlug, nextAppSlug),
            eq(vctx.sql.tables.appSlugAlias.appSlug, nextAppSlug)
          )
        );

      await tx
        .update(vctx.sql.tables.apps)
        .set({ appSlug: nextAppSlug })
        .where(and(eq(vctx.sql.tables.apps.userSlug, args.userSlug), eq(vctx.sql.tables.apps.appSlug, args.fromAppSlug)));

      await tx
        .update(vctx.sql.tables.chatContexts)
        .set({ appSlug: nextAppSlug })
        .where(
          and(eq(vctx.sql.tables.chatContexts.userSlug, args.userSlug), eq(vctx.sql.tables.chatContexts.appSlug, args.fromAppSlug))
        );

      await tx
        .update(vctx.sql.tables.applicationChats)
        .set({ appSlug: nextAppSlug })
        .where(
          and(
            eq(vctx.sql.tables.applicationChats.userSlug, args.userSlug),
            eq(vctx.sql.tables.applicationChats.appSlug, args.fromAppSlug)
          )
        );

      await tx
        .update(vctx.sql.tables.appSettings)
        .set({
          appSlug: nextAppSlug,
          updated: now,
        })
        .where(
          and(eq(vctx.sql.tables.appSettings.userSlug, args.userSlug), eq(vctx.sql.tables.appSettings.appSlug, args.fromAppSlug))
        );

      await tx
        .update(vctx.sql.tables.requestGrants)
        .set({
          appSlug: nextAppSlug,
          updated: now,
        })
        .where(
          and(
            eq(vctx.sql.tables.requestGrants.userSlug, args.userSlug),
            eq(vctx.sql.tables.requestGrants.appSlug, args.fromAppSlug)
          )
        );

      await tx
        .update(vctx.sql.tables.inviteGrants)
        .set({
          appSlug: nextAppSlug,
          updated: now,
        })
        .where(
          and(eq(vctx.sql.tables.inviteGrants.userSlug, args.userSlug), eq(vctx.sql.tables.inviteGrants.appSlug, args.fromAppSlug))
        );

      await tx
        .update(vctx.sql.tables.appDocuments)
        .set({ appSlug: nextAppSlug })
        .where(
          and(eq(vctx.sql.tables.appDocuments.userSlug, args.userSlug), eq(vctx.sql.tables.appDocuments.appSlug, args.fromAppSlug))
        );

      await tx
        .update(vctx.sql.tables.assetUploads)
        .set({ appSlug: nextAppSlug })
        .where(
          and(eq(vctx.sql.tables.assetUploads.userSlug, args.userSlug), eq(vctx.sql.tables.assetUploads.appSlug, args.fromAppSlug))
        );
    })
  );

  if (rRename.isErr()) return Result.Err(rRename.Err());
  return Result.Ok({ appSlug: nextAppSlug });
}

export async function ensureAppSettings(
  vctx: VibesApiSQLCtx,
  req: ReqEnsureAppSettings,
  userId?: string
): Promise<Result<ResEnsureAppSettings>> {
  const rCanonicalAppSlug = await resolveCanonicalAppSlug(vctx, {
    userSlug: req.userSlug,
    appSlug: req.appSlug,
  });
  if (rCanonicalAppSlug.isErr()) {
    return Result.Err(rCanonicalAppSlug.Err());
  }
  const resolvedReq = {
    ...req,
    appSlug: rCanonicalAppSlug.Ok(),
  } as ReqEnsureAppSettings;

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
          eq(vctx.sql.tables.appSettings.appSlug, resolvedReq.appSlug),
          eq(vctx.sql.tables.appSettings.userSlug, vctx.sql.tables.userSlugBinding.userSlug)
        )
      )
      .where(
        and(
          eq(vctx.sql.tables.appSlugBinding.userSlug, resolvedReq.userSlug),
          eq(vctx.sql.tables.appSlugBinding.appSlug, resolvedReq.appSlug)
        )
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
        appSlug: resolvedReq.appSlug,
        ledger: resolvedReq.appSlug,
        userSlug: resolvedReq.userSlug,
        tenant: resolvedReq.userSlug,
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
        appSlug: resolvedReq.appSlug,
        ledger: record.AppSlugBindings.ledger,
        userSlug: resolvedReq.userSlug,
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
    appSlug: resolvedReq.appSlug,
    ledger: record.AppSlugBindings.ledger,
    userSlug: resolvedReq.userSlug,
    tenant: record.UserSlugBindings.tenant,
    error: undefined as string | undefined,
    settings: buildEnsureEntryResult(settings),
    updated: now,
    created: record.AppSettings.created,
  } satisfies ResEnsureAppSettings;
  switch (true) {
    // case isReqEnsureAppSettingsAcl(resolvedReq):
    // await aclAction(vctx, resolvedReq, res, settings);
    // break;

    case isReqPublicAccess(resolvedReq):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isEnablePublicAccess,
        () =>
          ({
            type: "app.public.access",
            enable: resolvedReq.publicAccess.enable,
          }) satisfies EnablePublicAccess
      );
      break;

    case isReqRequest(resolvedReq): {
      const prevAutoAcceptRole = settings.find(isEnableRequest)?.autoAcceptRole;
      const nextAutoAcceptRole = resolvedReq.request.autoAcceptRole;

      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isEnableRequest,
        () =>
          ({
            type: "app.request",
            enable: resolvedReq.request.enable,
            autoAcceptRole: resolvedReq.request.autoAcceptRole,
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

    case isReqEnsureAppSettingsTitle(resolvedReq):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveTitle,
        () =>
          ({
            type: "active.title",
            title: resolvedReq.title,
          }) satisfies ActiveTitle
      );
      break;

    case isReqEnsureAppSettingsAppSlug(resolvedReq): {
      const rRenamed = await renameAppSlug(vctx, {
        userSlug: res.userSlug,
        fromAppSlug: res.appSlug,
        requestedNextAppSlug: resolvedReq.nextAppSlug,
      });
      if (rRenamed.isErr()) {
        const err = rRenamed.Err();
        res.error = err instanceof Error ? err.message : `${err}`;
        break;
      }
      res.appSlug = rRenamed.Ok().appSlug;
      const rPersist = await sqlUpdateSettings(vctx, res, settings);
      if (rPersist.isErr()) {
        const err = rPersist.Err();
        res.error = err instanceof Error ? err.message : `${err}`;
      }
      break;
    }

    case isReqEnsureAppSettingsIconDescription(resolvedReq):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveIconDescription,
        () =>
          ({
            type: "active.icon-description",
            description: resolvedReq.iconDescription,
          }) satisfies ActiveIconDescription
      );
      if (!res.error) {
        await postIconGen(vctx, { userSlug: res.userSlug, appSlug: res.appSlug, force: false });
      }
      break;
    case isReqEnsureAppSettingsIconRegen(resolvedReq):
      // No entry mutation — pure regen request. Rate-limit on the head
      // version's `created` to bound double-click cost.
      if (!recentlyRegenerated(settings)) {
        await postIconGen(vctx, { userSlug: res.userSlug, appSlug: res.appSlug, force: true });
      }
      break;
    case isReqEnsureAppSettingsSkills(resolvedReq):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveSkills,
        () =>
          ({
            type: "active.skills",
            skills: resolvedReq.skills,
          }) satisfies ActiveSkills
      );
      break;
    case isReqEnsureAppSettingsTheme(resolvedReq):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveTheme,
        () =>
          ({
            type: "active.theme",
            theme: resolvedReq.theme,
          }) satisfies ActiveTheme
      );
      break;
    case isReqEnsureAppSettingsApp(resolvedReq):
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
              ...resolvedReq.app,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsChat(resolvedReq):
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
              ...resolvedReq.chat,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsImg(resolvedReq):
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
              ...resolvedReq.img,
            },
          }) satisfies ActiveModelSetting
      );
      break;
    case isReqEnsureAppSettingsEnv(resolvedReq):
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
              ...resolvedReq.env,
            ],
          }) satisfies ActiveEnv
      );
      break;
    case isReqEnsureAppSettingsDbAcl(resolvedReq):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        // Match per-(dbName) rather than the first ActiveDbAcl entry —
        // each dbName gets its own row in the entries array.
        (e) => isActiveDbAcl(e) && e.dbName === resolvedReq.dbAcl.dbName,
        () =>
          ({
            type: "active.db-acl",
            dbName: resolvedReq.dbAcl.dbName,
            acl: resolvedReq.dbAcl.acl,
          }) satisfies ActiveDbAcl
      );
      break;
    case isReqEnsureAppSettingsDbAclRemove(resolvedReq):
      [res.settings, res.error] = await sqlRemove(
        vctx,
        res,
        settings,
        (e) => isActiveDbAcl(e) && e.dbName === resolvedReq.dbAclRemove.dbName
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
