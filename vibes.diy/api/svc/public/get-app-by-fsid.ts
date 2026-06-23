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
import { selectLatestAppPerSlug } from "./select-app.js";
import { deriveDisplayName } from "./derive-display-name.js";
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

function resolveOwnerDisplayName(ownerSettings: unknown[] | undefined, ownerClaims: ClerkClaim | undefined): string | undefined {
  for (const item of ownerSettings ?? []) {
    if (!isUserSettingProfile(item)) continue;
    const displayName = item.displayName?.trim();
    if (displayName) return displayName;
  }
  if (ownerClaims) {
    const derived = deriveDisplayName(ownerClaims).trim();
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
              eq(vctx.sql.tables.apps.ownerHandle, req.ownerHandle)
            )
          )
          .limit(1)
          .then((r) => r[0]);
      } else {
        app = await selectLatestAppPerSlug(vctx, { ownerHandle: req.ownerHandle, appSlug: req.appSlug });
      }

      if (!app) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-app-by-fsid",
          error: "app-not-found",
          appSlug: req.appSlug,
          ownerHandle: req.ownerHandle,
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
        ownerHandle: app.ownerHandle,
      });
      if (rAppSet.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-app-by-fsid",
          error: "app-settings-not-found",
          appSlug: req.appSlug,
          ownerHandle: req.ownerHandle,
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
          // Signed-in users on apps with autoAcceptRole get promoted above public-access.
          // Check for an existing approved request first; if none, auto-fire one.
          if (reqUserId && settings.entry.enableRequest?.autoAcceptRole !== undefined) {
            const rHasRequest = await hasAccessRequest(vctx, {
              appSlug: app.appSlug,
              ownerHandle: app.ownerHandle,
              foreignUserId: reqUserId,
            });
            if (rHasRequest.isOk()) {
              const hasRequest = rHasRequest.Ok();
              if (isResHasAccessRequestApproved(hasRequest)) {
                grant = grantedAccess(hasRequest.role);
              } else if (isResHasAccessRequestRevoked(hasRequest)) {
                // revoked — leave them on public-access, don't re-fire
              } else if (!isResHasAccessRequestPending(hasRequest)) {
                const rRequestAccess = await requestAccess(vctx, {
                  appSlug: app.appSlug,
                  ownerHandle: app.ownerHandle,
                  foreignUserId: reqUserId,
                  claims: req._auth?.verifiedAuth.claims,
                });
                if (rRequestAccess.isOk()) {
                  const raRes = rRequestAccess.Ok();
                  if (isResRequestAccessApproved(raRes)) {
                    grant = grantedAccess(raRes.role);
                  }
                }
              }
            }
          }
        } else {
          // console.log(`-1`, settings.entry, settings.entries);
          const rHasInvite = await hasAccessInvite(vctx, { ...req, grantUserId: reqUserId });
          // console.log(`-2`, rHasInvite);
          if (rHasInvite.isErr()) {
            await ctx.send.send(ctx, {
              type: "vibes.diy.res-get-app-by-fsid",
              error: "access-invite-check-failed",
              appSlug: req.appSlug,
              ownerHandle: req.ownerHandle,
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
                    ownerHandle: req.ownerHandle,
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
              grant = "req-login.request";
            } else {
              const rHasRequest = await hasAccessRequest(vctx, {
                appSlug: app.appSlug,
                ownerHandle: app.ownerHandle,
                foreignUserId: reqUserId,
              });
              if (rHasRequest.isErr()) {
                await ctx.send.send(ctx, {
                  type: "vibes.diy.res-get-app-by-fsid",
                  error: "access-request-check-failed",
                  appSlug: req.appSlug,
                  ownerHandle: req.ownerHandle,
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
                    ownerHandle: app.ownerHandle,
                    foreignUserId: reqUserId,
                    claims: req._auth?.verifiedAuth.claims,
                  });
                  if (rRequestAccess.isErr()) {
                    await ctx.send.send(ctx, {
                      type: "vibes.diy.res-get-app-by-fsid",
                      error: "request-access-failed",
                      appSlug: req.appSlug,
                      ownerHandle: req.ownerHandle,
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
            ownerHandle: "not-existing",
            fsId: "not-found",
            grant: "not-grant",
            mode: "dev",
            releaseSeq: -1,
            env: {},
            fileSystem: [],
            meta: [],
            created: new Date().toISOString(),
          } satisfies ResGetAppByFsId);
          // Terminal fallback: without an early return we'd fall through and
          // send a second response below with `grant: undefined`, which fails
          // the res-get-app-by-fsid schema (#2425).
          return Result.Ok(EventoResult.Continue);
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
      // The active icon is already projected onto settings.entry.settings.icon
      // (head version cid+mime); pass it through so callers get the icon without
      // a separate authed list-recent-vibes round-trip.
      const icon = settings.entry.settings.icon;
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-app-by-fsid",
        appSlug: app.appSlug,
        ownerHandle: app.ownerHandle,
        ...(ownerDisplayName ? { ownerDisplayName } : {}),
        ...(icon ? { icon } : {}),
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
