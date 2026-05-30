import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetAppByFsId,
  ReqGetAppByFsId,
  ResGetAppByFsId,
  ClerkClaim,
  VibesDiyError,
  W3CWebSocketEvent,
  FileSystemItem,
  MetaItem,
  ReqWithOptionalAuth,
  isUserSettingProfile,
  isResHasAccessInviteAccepted,
  isResHasAccessInvitePending,
  isResHasAccessRequestApproved,
  isResHasAccessRequestPending,
  isResHasAccessRequestRevoked,
  isResRequestAccessApproved,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { and, eq } from "drizzle-orm/sql/expressions";
import { max } from "drizzle-orm/sql";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { hasAccessInvite, redeemInvite } from "./invite-flow.js";
import { hasAccessRequest, requestAccess } from "./request-flow.js";

function grantedAccess(role: "editor" | "viewer" | "submitter") {
  switch (role) {
    case "editor":
      return "granted-access.editor";
    case "submitter":
      return "granted-access.submitter";
    case "viewer":
    default:
      return "granted-access.viewer";
  }
}

// Keep precedence aligned with list-members.ts:deriveAuthorDisplay.
function deriveAuthorDisplay(claims: ClerkClaim): string {
  const p = claims.params;
  if (p.nick !== undefined && p.nick.trim() !== "") return p.nick.trim();
  if (p.name !== null && p.name.trim() !== "") return p.name.trim();
  const composed = `${p.first} ${p.last}`.trim();
  if (composed !== "") return composed;
  return p.email;
}

function resolveOwnerDisplayName(ownerSettings: unknown[] | undefined, ownerClaims: ClerkClaim | undefined): string | undefined {
  for (const item of ownerSettings ?? []) {
    if (!isUserSettingProfile(item)) continue;
    const displayName = item.displayName?.trim();
    if (displayName) return displayName;
  }
  if (ownerClaims) {
    const derived = deriveAuthorDisplay(ownerClaims).trim();
    if (derived !== "") return derived;
  }
  return undefined;
}

// function getKeyFromAuth<T extends { type: string; auth?: DashAuthType | undefined }>(req: ReqWithOptionalAuth<T>) {
//   return (
//     req._auth?.verifiedAuth?.claims.params.email ??
//     req._auth?.verifiedAuth?.claims.params.nick ??
//     req._auth?.verifiedAuth?.claims.params.name ??
//     "@anonymous@"
//   );
// }

export const getAppByFsIdEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqGetAppByFsId>, ResGetAppByFsId | VibesDiyError> = {
  hash: "get-app-by-fsid",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetAppByFsId(msg.payload);
    if (ret instanceof type.errors) {
      // console.log(`xxxx`, ret.summary);
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqGetAppByFsId>>, ResGetAppByFsId | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // // Determine if the caller is the owner
      const callerUserId = req._auth?.verifiedAuth.claims.userId;
      // console.log(`getAppByFsIdEvento called with req`, req, `callerUserId`, callerUserId);

      let app: typeof vctx.sql.tables.apps.$inferSelect | undefined;
      if (req.fsId) {
        app = await vctx.sql.db
          .select()
          .from(vctx.sql.tables.apps)
          .where(
            and(
              eq(vctx.sql.tables.apps.fsId, req.fsId),
              eq(vctx.sql.tables.apps.appSlug, req.appSlug),
              eq(vctx.sql.tables.apps.userSlug, req.userSlug)
            )
          )
          .limit(1)
          .then((r) => r[0]);
      } else {
        const maxCreatedSub = vctx.sql.db
          .select({ mode: vctx.sql.tables.apps.mode, maxCreated: max(vctx.sql.tables.apps.created).as("max_created") })
          .from(vctx.sql.tables.apps)
          .where(and(eq(vctx.sql.tables.apps.userSlug, req.userSlug), eq(vctx.sql.tables.apps.appSlug, req.appSlug)))
          .groupBy(vctx.sql.tables.apps.mode)
          .as("mc");
        const rows = await vctx.sql.db
          .select({
            appSlug: vctx.sql.tables.apps.appSlug,
            userId: vctx.sql.tables.apps.userId,
            userSlug: vctx.sql.tables.apps.userSlug,
            releaseSeq: vctx.sql.tables.apps.releaseSeq,
            fsId: vctx.sql.tables.apps.fsId,
            env: vctx.sql.tables.apps.env,
            fileSystem: vctx.sql.tables.apps.fileSystem,
            meta: vctx.sql.tables.apps.meta,
            mode: vctx.sql.tables.apps.mode,
            created: vctx.sql.tables.apps.created,
          })
          .from(vctx.sql.tables.apps)
          .innerJoin(
            maxCreatedSub,
            and(
              eq(vctx.sql.tables.apps.mode, maxCreatedSub.mode),
              eq(vctx.sql.tables.apps.created, maxCreatedSub.maxCreated),
              eq(vctx.sql.tables.apps.userSlug, req.userSlug),
              eq(vctx.sql.tables.apps.appSlug, req.appSlug)
            )
          )
          .orderBy(vctx.sql.tables.apps.mode); // "dev" < "production" → last = production wins
        app = rows[rows.length - 1];
      }

      if (!app) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-app-by-fsid",
          error: "app-not-found",
          appSlug: req.appSlug,
          userSlug: req.userSlug,
          fsId: req.fsId,
          grant: "not-found",
          mode: "dev",
          releaseSeq: -1,
          env: {},
          fileSystem: [],
          meta: [],
          created: new Date().toISOString(),
        } satisfies ResGetAppByFsId);
        return Result.Ok(EventoResult.Continue);
      }

      // Settings carry the displayable app title (active.title), which Apps.meta
      // doesn't always include. Fetch once so both owner and non-owner branches
      // can surface the real title to the viewer.
      const rAppSet = await ensureAppSettings(vctx, {
        type: "vibes.diy.req-ensure-app-settings",
        appSlug: app.appSlug,
        userSlug: app.userSlug,
      });
      if (rAppSet.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-app-by-fsid",
          error: "app-settings-not-found",
          appSlug: req.appSlug,
          userSlug: req.userSlug,
          fsId: req.fsId,
          grant: "not-found",
          mode: "dev",
          releaseSeq: -1,
          env: {},
          fileSystem: [],
          meta: [],
          created: new Date().toISOString(),
        } satisfies ResGetAppByFsId);
        return Result.Ok(EventoResult.Continue);
      }
      const settings = rAppSet.Ok().settings;

      const ownerSettingsRow = await vctx.sql.db
        .select({ settings: vctx.sql.tables.userSettings.settings })
        .from(vctx.sql.tables.userSettings)
        .where(eq(vctx.sql.tables.userSettings.userId, app.userId))
        .limit(1)
        .then((r) => r[0]);
      const ownerDisplayName = resolveOwnerDisplayName(
        ownerSettingsRow?.settings as unknown[] | undefined,
        callerUserId === app.userId ? req._auth?.verifiedAuth.claims : undefined
      );

      let grant!: ResGetAppByFsId["grant"];
      // If not the owner, only return production apps
      const isOwner = callerUserId && callerUserId === app?.userId;
      // console.log(`isOwner`, isOwner, callerUserId, app.userId);
      if (isOwner) {
        grant = "owner";
      } else {
        const reqUserId = req._auth?.verifiedAuth?.claims.userId;

        if (settings.entry.publicAccess?.enable && app.mode === "production") {
          grant = "public-access";
          // here we would could
        } else {
          // console.log(`-1`, settings.entry, settings.entries);
          const rHasInvite = await hasAccessInvite(vctx, { ...req, grantUserId: reqUserId });
          // console.log(`-2`, rHasInvite);
          if (rHasInvite.isErr()) {
            await ctx.send.send(ctx, {
              type: "vibes.diy.res-get-app-by-fsid",
              error: "access-invite-check-failed",
              appSlug: req.appSlug,
              userSlug: req.userSlug,
              fsId: req.fsId,
              grant: "not-found",
              mode: "dev",
              releaseSeq: -1,
              env: {},
              fileSystem: [],
              meta: [],
              created: new Date().toISOString(),
            } satisfies ResGetAppByFsId);
            return Result.Ok(EventoResult.Continue);
          }
          const hasInvite = rHasInvite.Ok();
          if (isResHasAccessInviteAccepted(hasInvite)) {
            grant = grantedAccess(hasInvite.role);
          }
          if (!grant && req.token) {
            if (isResHasAccessInvitePending(hasInvite) && hasInvite.tokenOrGrantUserId === req.token) {
              if (!reqUserId) {
                grant = "req-login.invite";
              } else {
                const rRedeemInvite = await redeemInvite(vctx, {
                  token: req.token,
                  redeemerId: reqUserId,
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  claims: req._auth!.verifiedAuth.claims,
                });
                if (rRedeemInvite.isErr()) {
                  await ctx.send.send(ctx, {
                    type: "vibes.diy.res-get-app-by-fsid",
                    error: "redeem-invite-failed",
                    appSlug: req.appSlug,
                    userSlug: req.userSlug,
                    fsId: req.fsId,
                    grant: "not-found",
                    mode: "dev",
                    releaseSeq: -1,
                    env: {},
                    fileSystem: [],
                    meta: [],
                    created: new Date().toISOString(),
                  } satisfies ResGetAppByFsId);
                  return Result.Ok(EventoResult.Continue);
                }
                grant = "accepted-email-invite";
              }
            }
          } else if (settings.entry.enableRequest) {
            const autoJoinEnabled = settings.entry.enableRequest.autoAcceptRole !== undefined;
            if (!reqUserId) {
              grant = autoJoinEnabled ? "req-login.auto-join" : "req-login.request";
            } else {
              const rHasRequest = await hasAccessRequest(vctx, {
                appSlug: app.appSlug,
                userSlug: app.userSlug,
                foreignUserId: reqUserId,
              });
              if (rHasRequest.isErr()) {
                await ctx.send.send(ctx, {
                  type: "vibes.diy.res-get-app-by-fsid",
                  error: "access-request-check-failed",
                  appSlug: req.appSlug,
                  userSlug: req.userSlug,
                  fsId: req.fsId,
                  grant: "not-found",
                  mode: "dev",
                  releaseSeq: -1,
                  env: {},
                  fileSystem: [],
                  meta: [],
                  created: new Date().toISOString(),
                } satisfies ResGetAppByFsId);
                return Result.Ok(EventoResult.Continue);
              }
              const hasRequest = rHasRequest.Ok();
              switch (true) {
                case isResHasAccessRequestApproved(hasRequest):
                  grant = grantedAccess(hasRequest.role);
                  break;
                case isResHasAccessRequestPending(hasRequest):
                  grant = "pending-request";
                  break;
                case isResHasAccessRequestRevoked(hasRequest):
                  grant = "revoked-access";
                  break;
              }
              if (!grant) {
                if (autoJoinEnabled) {
                  const rRequestAccess = await requestAccess(vctx, {
                    appSlug: app.appSlug,
                    userSlug: app.userSlug,
                    foreignUserId: reqUserId,
                    claims: req._auth?.verifiedAuth.claims,
                  });
                  if (rRequestAccess.isErr()) {
                    await ctx.send.send(ctx, {
                      type: "vibes.diy.res-get-app-by-fsid",
                      error: "request-access-failed",
                      appSlug: req.appSlug,
                      userSlug: req.userSlug,
                      fsId: req.fsId,
                      grant: "not-found",
                      mode: "dev",
                      releaseSeq: -1,
                      env: {},
                      fileSystem: [],
                      meta: [],
                      created: new Date().toISOString(),
                    } satisfies ResGetAppByFsId);
                    return Result.Ok(EventoResult.Continue);
                  }
                  const requestAccessRes = rRequestAccess.Ok();
                  if (isResRequestAccessApproved(requestAccessRes)) {
                    grant = grantedAccess(requestAccessRes.role);
                  } else {
                    grant = "pending-request";
                  }
                } else {
                  grant = "req-login.request";
                }
              }
            }
          }
        }
        if (!grant) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-get-app-by-fsid",
            appSlug: "not-existing",
            userSlug: "not-existing",
            fsId: "not-found",
            grant: "not-grant",
            mode: "dev",
            releaseSeq: -1,
            env: {},
            fileSystem: [],
            meta: [],
            created: new Date().toISOString(),
          } satisfies ResGetAppByFsId);
        }
      }
      // Inject the displayable title (from AppSettings.active.title) into the
      // meta array if it isn't already there. Frontends read it via
      // isMetaTitle(); previously they fell back to the slug because writes
      // only persisted the title to settings, not to Apps.meta.
      const baseMeta = app.meta as MetaItem[];
      const titleStr = settings.entry.settings.title;
      const meta: MetaItem[] =
        titleStr !== undefined && baseMeta.some((m) => m.type === "title") === false
          ? [...baseMeta, { type: "title", title: titleStr }]
          : baseMeta;
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-app-by-fsid",
        appSlug: app.appSlug,
        userSlug: app.userSlug,
        ...(ownerDisplayName ? { ownerDisplayName } : {}),
        fsId: app.fsId,
        grant,
        mode: app.mode as "production" | "dev",
        releaseSeq: app.releaseSeq,
        env: app.env as Record<string, string>,
        fileSystem: app.fileSystem as FileSystemItem[],
        meta,
        created: app.created,
      } satisfies ResGetAppByFsId);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
