import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetAppByFsId,
  ReqGetAppByFsId,
  ResGetAppByFsId,
  VibesDiyError,
  W3CWebSocketEvent,
  FileSystemItem,
  MetaItem,
  ReqWithOptionalAuth,
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
import { seedDefaultDbPolicies } from "./app-db-policies.js";

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

      if (app) {
        // Backfill default per-dbName policies (e.g. comments) on every load.
        // Idempotent INSERT … ON CONFLICT DO NOTHING — costs one upsert per load.
        await seedDefaultDbPolicies(vctx, app.userSlug, app.appSlug);
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

      let grant!: ResGetAppByFsId["grant"];
      // If not the owner, only return production apps
      const isOwner = callerUserId && callerUserId === app?.userId;
      // console.log(`isOwner`, isOwner, callerUserId, app.userId);
      if (isOwner) {
        grant = "owner";
      } else {
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

        const reqUserId = req._auth?.verifiedAuth?.claims.userId;
        const settings = rAppSet.Ok().settings;

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
            if (!reqUserId) {
              grant = "req-login.request";
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
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-app-by-fsid",
        appSlug: app.appSlug,
        userSlug: app.userSlug,
        fsId: app.fsId,
        grant,
        mode: app.mode as "production" | "dev",
        releaseSeq: app.releaseSeq,
        env: app.env as Record<string, string>,
        fileSystem: app.fileSystem as FileSystemItem[],
        meta: app.meta as MetaItem[],
        created: app.created,
      } satisfies ResGetAppByFsId);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
