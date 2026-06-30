import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  ActiveCachedSuggestion,
  ActiveCachedSuggestionBless,
  ActiveDbAcl,
  ActiveEntry,
  ActiveIconDescription,
  parseArrayWarning,
  ActiveEnv,
  ActiveModelSetting,
  ActiveColorTheme,
  ActiveSkills,
  ActiveTheme,
  ActiveTitle,
  AppSettings,
  EnablePublicAccess,
  EnableRequest,
  EvtAppSetting,
  EvtIconGen,
  isActiveCachedSuggestion,
  isActiveCachedSuggestionBless,
  isActiveDbAcl,
  isActiveEnv,
  isActiveIcon,
  isActiveIconDescription,
  isActiveModelSettingRuntime,
  isActiveModelSettingCodegen,
  isActiveModelSettingImg,
  isActiveColorTheme,
  isActiveSkills,
  isActiveTheme,
  isReqEnsureAppSettingsColorTheme,
  isReqEnsureAppSettingsIconDescription,
  isReqEnsureAppSettingsIconRegen,
  isReqEnsureAppSettingsImg,
  isReqEnsureAppSettingsSkills,
  isReqEnsureAppSettingsTheme,
  isActiveTitle,
  isEnablePublicAccess,
  isEnableRequest,
  isReqEnsureAppSettings,
  isReqEnsureAppSettingsRuntime,
  isReqEnsureAppSettingsCodegen,
  isReqEnsureAppSettingsCachedSuggestion,
  isReqEnsureAppSettingsCachedSuggestionBless,
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
import { ensureLogger } from "@vibes.diy/identity";
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
      case isActiveTheme(e):
        result.entry.settings.theme = e.theme;
        break;
      case isActiveColorTheme(e):
        result.entry.settings.colorTheme = e.colorTheme;
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
      case isActiveModelSettingCodegen(e):
        result.entry.settings.codegen = e.param;
        break;
      case isActiveModelSettingRuntime(e):
        result.entry.settings.runtime = e.param;
        break;
      case isActiveModelSettingImg(e):
        result.entry.settings.img = e.param;
        break;
      case isActiveEnv(e):
        result.entry.settings.env.push(...e.env);
        break;
      case isActiveCachedSuggestion(e):
        result.entry.cachedSuggestions = result.entry.cachedSuggestions ?? {};
        result.entry.cachedSuggestions[e.key] = { fsId: e.fsId, sourceFsId: e.sourceFsId };
        break;
      case isActiveCachedSuggestionBless(e):
        result.entry.cachedSuggestionBlesses = result.entry.cachedSuggestionBlesses ?? {};
        result.entry.cachedSuggestionBlesses[e.key] = {
          fsId: e.fsId,
          sourceFsId: e.sourceFsId,
          approvedBy: e.approvedBy,
          approvedAt: e.approvedAt,
        };
        break;
      case isActiveDbAcl(e):
        result.entry.dbAcls = result.entry.dbAcls ?? {};
        result.entry.dbAcls[e.dbName] = e.acl;
        break;
    }
  });
  return result;
}

// Bound the model-defaults augmentation so a slow/hung models.json fetch
// (Lazy cache resets every 10s, asset fetch goes over the network) can't
// stall the response *after* the actual D1 write has already succeeded.
// On timeout we return res unchanged — the client already has the write
// confirmation it needs; codegen/runtime/img defaults are best-effort metadata.
const MODEL_DEFAULTS_TIMEOUT_MS = 3000;

async function withModelDefaults(vctx: VibesApiSQLCtx, res: ResEnsureAppSettings): Promise<ResEnsureAppSettings> {
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), MODEL_DEFAULTS_TIMEOUT_MS));
  const raced = await Promise.race([getModelDefaults(vctx, { appSlug: res.appSlug, ownerHandle: res.ownerHandle }), timeout]);
  if (raced === "timeout") {
    ensureLogger(vctx.sthis, "ensureAppSettings").Warn().Msg("withModelDefaults timed out, returning res without defaults");
    return res;
  }
  if (raced.isErr()) return res;
  const defaults = raced.Ok();
  const s = res.settings.entry.settings;
  if (!s.codegen) s.codegen = defaults.codegen;
  if (!s.runtime) s.runtime = defaults.runtime;
  if (!s.img) s.img = defaults.img;
  return res;
}

async function postIconGen(vctx: VibesApiSQLCtx, args: { ownerHandle: string; appSlug: string; force: boolean }): Promise<void> {
  await vctx.postQueue({
    payload: {
      type: "vibes.diy.evt-icon-gen",
      ownerHandle: args.ownerHandle,
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

// Admin-on-behalf bless (#2929 item 3) — the platform-admin allowlist.
//
// There is no pre-existing server-side admin authority (the client `adminMode`
// flag is self-asserted and only ever elevates the *owner*). So admin-on-behalf
// blessing introduces one, deliberately minimal: a comma-separated allowlist of
// VERIFIED Clerk userIds in `VIBES_ADMIN_USER_IDS`. Unset/empty ⇒ the set is
// empty ⇒ nobody is an admin ⇒ the whole capability is inert (no behavior change
// in any environment until an operator explicitly populates it). The userId
// checked against it always comes from a verified token (`_auth`), never the
// request body.
function adminUserIdSet(vctx: VibesApiSQLCtx): Set<string> {
  const raw = vctx.sthis.env.get("VIBES_ADMIN_USER_IDS");
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );
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
      .from(vctx.sql.tables.handleBinding)
      .innerJoin(
        vctx.sql.tables.appSlugBinding,
        eq(vctx.sql.tables.appSlugBinding.ownerHandle, vctx.sql.tables.handleBinding.handle)
      )
      .leftJoin(
        vctx.sql.tables.appSettings,
        and(
          eq(vctx.sql.tables.appSettings.userId, vctx.sql.tables.handleBinding.userId),
          eq(vctx.sql.tables.appSettings.appSlug, req.appSlug),
          eq(vctx.sql.tables.appSettings.ownerHandle, vctx.sql.tables.handleBinding.handle)
        )
      )
      .where(
        and(
          eq(vctx.sql.tables.appSlugBinding.ownerHandle, req.ownerHandle),
          eq(vctx.sql.tables.appSlugBinding.appSlug, req.appSlug)
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

  // The owner is the only identity that may mutate settings — EXCEPT the one
  // additive case below. `isAdminBless` lets an allowlisted platform admin pass
  // the gate for a SINGLE request type (a cached-suggestion bless/revoke) on an
  // app they don't own — admin-on-behalf curation (#2929 item 3). It requires the
  // app to exist (`record`), the caller to NOT be the owner, the request to be a
  // bless, and the verified caller to be in the admin allowlist. Every other
  // settings mutation by a non-owner still falls through to the read-only return.
  const isOwner = !!userId && userId === record?.UserSlugBindings.userId;
  const isAdminBless =
    !!userId && !!record && !isOwner && isReqEnsureAppSettingsCachedSuggestionBless(req) && adminUserIdSet(vctx).has(userId);

  if (!userId || (!isOwner && !isAdminBless)) {
    if (!record) {
      return Result.Ok({
        type: "vibes.diy.res-ensure-app-settings",
        userId: "------",
        appSlug: req.appSlug,
        ledger: req.appSlug,
        ownerHandle: req.ownerHandle,
        tenant: req.ownerHandle,
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
        ownerHandle: req.ownerHandle,
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
    ownerHandle: record.UserSlugBindings.handle,
    appSlug: record.AppSlugBindings.appSlug,
  };

  const { filtered: settings, warning: settingsWarning2 } = parseArrayWarning(record.AppSettings.settings || [], ActiveEntry);
  if (settingsWarning2.length > 0) {
    ensureLogger(vctx.sthis, "ensureAppSettings").Warn().Any({ parseErrors: settingsWarning2 }).Msg("skip");
  }
  // The settings row this write lands in is ALWAYS owned by the app owner — even
  // on the admin-on-behalf path, where `userId` is the admin's. Keying it on the
  // owner is what makes the bless land in the row the reader/grant actually read
  // (they resolve via the owner's handle binding); an admin's id here would mint a
  // stray row keyed on `(adminUserId, ownerHandle, appSlug)` that nothing serves.
  // The *approver* identity (the verified caller — owner or admin) is captured
  // separately for the bless audit (`approvedBy`).
  const ownerUserId = record.UserSlugBindings.userId;
  const approverUserId = userId;
  const res = {
    type: "vibes.diy.res-ensure-app-settings",
    userId: ownerUserId,
    appSlug: req.appSlug,
    ledger: record.AppSlugBindings.ledger,
    ownerHandle: req.ownerHandle,
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
            ownerHandle: res.ownerHandle,
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
        await postIconGen(vctx, { ownerHandle: res.ownerHandle, appSlug: res.appSlug, force: false });
      }
      break;
    case isReqEnsureAppSettingsIconRegen(req):
      // No entry mutation — pure regen request. Rate-limit on the head
      // version's `created` to bound double-click cost.
      if (!recentlyRegenerated(settings)) {
        await postIconGen(vctx, { ownerHandle: res.ownerHandle, appSlug: res.appSlug, force: true });
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
    case isReqEnsureAppSettingsTheme(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        isActiveTheme,
        () =>
          ({
            type: "active.theme",
            theme: req.theme,
          }) satisfies ActiveTheme
      );
      break;
    case isReqEnsureAppSettingsColorTheme(req):
      if (req.colorTheme === null) {
        [res.settings, res.error] = await sqlRemove(vctx, res, settings, isActiveColorTheme);
      } else {
        const colorTheme = req.colorTheme;
        [res.settings, res.error] = await sqlUpsert(
          vctx,
          res,
          settings,
          isActiveColorTheme,
          () => ({ type: "active.colorTheme", colorTheme }) satisfies ActiveColorTheme
        );
      }
      break;
    case isReqEnsureAppSettingsRuntime(req):
      // `runtime: null` clears the app-level override so the usage falls back to
      // the user/catalog default (mirrors the colorTheme/dbAclRemove remove path).
      if (req.runtime === null) {
        [res.settings, res.error] = await sqlRemove(vctx, res, settings, isActiveModelSettingRuntime);
      } else {
        const runtime = req.runtime;
        [res.settings, res.error] = await sqlUpsert(
          vctx,
          res,
          settings,
          isActiveModelSettingRuntime,
          (prev: ActiveModelSetting) =>
            ({
              type: "active.model",
              usage: "runtime",
              param: {
                ...prev.param,
                ...runtime,
              },
            }) satisfies ActiveModelSetting
        );
      }
      break;
    case isReqEnsureAppSettingsCodegen(req):
      if (req.codegen === null) {
        [res.settings, res.error] = await sqlRemove(vctx, res, settings, isActiveModelSettingCodegen);
      } else {
        const codegen = req.codegen;
        [res.settings, res.error] = await sqlUpsert(
          vctx,
          res,
          settings,
          isActiveModelSettingCodegen,
          (prev: ActiveModelSetting) =>
            ({
              type: "active.model",
              usage: "codegen",
              param: {
                ...prev.param,
                ...codegen,
              },
            }) satisfies ActiveModelSetting
        );
      }
      break;
    case isReqEnsureAppSettingsImg(req):
      if (req.img === null) {
        [res.settings, res.error] = await sqlRemove(vctx, res, settings, isActiveModelSettingImg);
      } else {
        const img = req.img;
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
                ...img,
              },
            }) satisfies ActiveModelSetting
        );
      }
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
    case isReqEnsureAppSettingsCachedSuggestion(req):
      [res.settings, res.error] = await sqlUpsert(
        vctx,
        res,
        settings,
        // Match per-(content-address key) — each cached chip gets its own row.
        (e) => isActiveCachedSuggestion(e) && e.key === req.cachedSuggestion.key,
        () =>
          ({
            type: "active.cached-suggestion",
            key: req.cachedSuggestion.key,
            fsId: req.cachedSuggestion.fsId,
            sourceFsId: req.cachedSuggestion.sourceFsId,
          }) satisfies ActiveCachedSuggestion
      );
      break;
    case isReqEnsureAppSettingsCachedSuggestionBless(req): {
      // Reached by the OWNER, or by an allowlisted platform admin on-behalf
      // (#2929 item 3) — the ONLY non-owner write that passes the gate. Either
      // way the entry lands in the owner's row (`res.userId === ownerUserId`);
      // `approvedBy` records the verified APPROVER (owner or admin) for audit.
      // Bless upserts the serve-eligibility entry; revoke removes it so the
      // result forks again (fail-to-fork). The produce-before-bless + tuple-match
      // checks below are identical for owner and admin, so an admin can only bless
      // a result the OWNER actually produced (the produce map is owner-write-only).
      const b = req.cachedSuggestionBless;
      if (approverUserId !== ownerUserId) {
        // Admin-on-behalf: audit every non-owner bless/revoke that reaches this
        // branch (i.e. passed the allowlist gate). Logged as an ATTEMPT — the
        // produce-before-bless / tuple-match check below can still reject it, so
        // the message stays neutral about whether the write landed.
        ensureLogger(vctx.sthis, "ensureAppSettings")
          .Info()
          .Str("reason", "adminOnBehalfBless")
          .Str("op", b.op)
          .Str("approvedBy", approverUserId)
          .Str("ownerHandle", req.ownerHandle)
          .Str("appSlug", req.appSlug)
          .Str("key", b.key)
          .Str("fsId", b.fsId)
          .Msg("admin on-behalf cached-suggestion bless/revoke (allowlisted)");
      }
      if (b.op === "revoke") {
        // Match the FULL tuple, not just the key (Codex #2915): a key can be
        // re-produced/re-blessed to a new fsId, so a stale revoke carrying the
        // OLD tuple must no-op rather than unpublish the current blessed result.
        [res.settings, res.error] = await sqlRemove(
          vctx,
          res,
          settings,
          (e) => isActiveCachedSuggestionBless(e) && e.key === b.key && e.fsId === b.fsId && e.sourceFsId === b.sourceFsId
        );
      } else {
        // Bless depends on produce (Codex #2915): only an EXISTING produced
        // result (matching active.cached-suggestion tuple) may be blessed, so a
        // bless can't conjure an arbitrary unpublished fsId into the serve map.
        // The check is in-memory over the already-loaded entries (no extra query).
        const produced = settings.find(
          (e) => isActiveCachedSuggestion(e) && e.key === b.key && e.fsId === b.fsId && e.sourceFsId === b.sourceFsId
        );
        if (!produced) {
          res.error = "cannot bless a cached suggestion with no matching produced entry";
          break;
        }
        [res.settings, res.error] = await sqlUpsert(
          vctx,
          res,
          settings,
          (e) => isActiveCachedSuggestionBless(e) && e.key === b.key,
          () =>
            ({
              type: "active.cached-suggestion-bless",
              key: b.key,
              fsId: b.fsId,
              sourceFsId: b.sourceFsId,
              approvedBy: approverUserId,
              approvedAt: now,
            }) satisfies ActiveCachedSuggestionBless
        );
      }
      break;
    }
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
  // Canonicalize: a singleton entry type may have accumulated duplicates
  // in storage (see #1707). Remove every match, push one updated entry
  // whose `prev` is the most recent matching entry. ActiveDbAcl's
  // per-dbName matcher means this still preserves entries for other dbNames.
  const prev = settings.findLast(match) as unknown as R | undefined;
  for (let i = settings.length - 1; i >= 0; i--) {
    if (match(settings[i])) settings.splice(i, 1);
  }
  settings.push(fn(prev ?? ({} as unknown as R)) as unknown as T);
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
        ownerHandle: res.ownerHandle,
        settings,
        updated: now,
        created: res.created,
      })
      .onConflictDoUpdate({
        target: [vctx.sql.tables.appSettings.userId, vctx.sql.tables.appSettings.ownerHandle, vctx.sql.tables.appSettings.appSlug],
        set: {
          settings: res.settings.entries,
          updated: now,
        },
      })
  );
  await vctx.postQueue({
    payload: {
      type: "vibes.diy.evt-app-setting",
      ownerHandle: res.ownerHandle,
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
//     ownerHandle: res.ownerHandle,
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
