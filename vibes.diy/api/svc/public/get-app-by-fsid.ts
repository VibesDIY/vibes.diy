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
  ActiveInviteEditorAccepted,
  ActiveInviteEditorPending,
  ActiveEntry,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { ReqWithOptionalAuth, optAuth } from "../check-auth.js";
import { sqlApps } from "../sql/vibes-diy-api-schema.js";
import { and, eq, max } from "drizzle-orm";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";

function grantedAccess(role: "editor" | "viewer") {
  switch (role) {
    case "editor":
      return "granted-access.editor";
    case "viewer":
    default:
      return "granted-access.viewer";
  }
}

function getKeyFromAuth<T extends { type: string; auth?: DashAuthType | undefined }>(req: ReqWithOptionalAuth<T>) {
  return (
    req._auth?.verifiedAuth?.claims.params.email ??
    req._auth?.verifiedAuth?.claims.params.nick ??
    req._auth?.verifiedAuth?.claims.params.name ??
    "@anonymous@"
  );
}

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

      let app: typeof sqlApps.$inferSelect | undefined;
      if (req.fsId) {
        app = await vctx.db
          .select()
          .from(sqlApps)
          .where(and(eq(sqlApps.fsId, req.fsId), eq(sqlApps.appSlug, req.appSlug), eq(sqlApps.userSlug, req.userSlug)))
          .get();
      } else {
        const maxCreatedSub = vctx.db
          .select({ mode: sqlApps.mode, maxCreated: max(sqlApps.created).as("max_created") })
          .from(sqlApps)
          .where(and(eq(sqlApps.userSlug, req.userSlug), eq(sqlApps.appSlug, req.appSlug)))
          .groupBy(sqlApps.mode)
          .as("mc");
        const rows = await vctx.db
          .select({
            appSlug: sqlApps.appSlug,
            userId: sqlApps.userId,
            userSlug: sqlApps.userSlug,
            releaseSeq: sqlApps.releaseSeq,
            fsId: sqlApps.fsId,
            env: sqlApps.env,
            fileSystem: sqlApps.fileSystem,
            meta: sqlApps.meta,
            mode: sqlApps.mode,
            created: sqlApps.created,
          })
          .from(sqlApps)
          .innerJoin(
            maxCreatedSub,
            and(
              eq(sqlApps.mode, maxCreatedSub.mode),
              eq(sqlApps.created, maxCreatedSub.maxCreated),
              eq(sqlApps.userSlug, req.userSlug),
              eq(sqlApps.appSlug, req.appSlug)
            )
          )
          .orderBy(sqlApps.mode) // "dev" < "production" → last = production wins
          .all();
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

      let grant!: ResGetAppByFsId["grant"];
      // If not the owner, only return production apps
      const isOwner = callerUserId && callerUserId === app?.userId;
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

        const approvetedUserId = req._auth?.verifiedAuth?.claims.userId;
        const settings = rAppSet.Ok().settings;

        if (settings.entry.publicAccess && app.mode === "production") {
          console.log(`grant-public`);
          grant = "public-access";
          // here we would could
        } else {
          if (approvetedUserId) {
            for (const i of [...settings.entry.invite.editors.accepted, ...settings.entry.invite.viewers.accepted]) {
              if (i.grant.ownerId === approvetedUserId) {
                grant = grantedAccess(i.role);
                break;
              }
            }
          }

          if (!grant && req.token) {
            for (const i of [...settings.entry.invite.editors.pending, ...settings.entry.invite.viewers.pending]) {
              console.log("has token", req.token, i.token);
              if (i.token !== req.token) {
                continue;
              }
              if (approvetedUserId) {
                const rEas = await ensureAppSettings(
                  vctx,
                  {
                    type: "vibes.diy.req-ensure-app-settings",
                    aclEntry: {
                      op: "upsert",
                      entry: {
                        ...(i as ActiveInviteEditorPending),
                        state: "accepted" as const,
                        grant: {
                          ownerId: approvetedUserId,
                          key: getKeyFromAuth(req),
                          on: new Date(),
                        },
                        tick: { count: 1, last: new Date() },
                      } as ActiveInviteEditorAccepted,
                    },
                    appSlug: app.appSlug,
                    userSlug: app.userSlug,
                  },
                  app.userId
                );
                // console.log(`xxxx`, rEas);
                if (rEas.isErr()) {
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
                grant = "accepted-email-invite";
              } else {
                grant = "req-login.invite";
              }
              break;
            }
          } else if (settings.entry.enableRequest) {
            if (!approvetedUserId) {
              grant = "req-login.request";
            } else {
              for (const i of settings.entry.request.approved) {
                if (i.request.userId === approvetedUserId) {
                  grant = grantedAccess(i.role);
                  break;
                }
              }
              for (const i of settings.entry.request.pending) {
                if (i.request.userId === approvetedUserId) {
                  grant = "pending-request";
                  break;
                }
              }
              for (const i of settings.entry.request.rejected) {
                if (i.request.userId === approvetedUserId) {
                  grant = "revoked-access";
                  break;
                }
              }
              if (!grant) {
                let entry: ActiveEntry;
                if (settings.entry.enableRequest?.autoAcceptViewRequest) {
                  grant = "granted-access.viewer";
                  entry = {
                    type: "app.acl.active.request",
                    role: "viewer",
                    state: "approved",
                    request: {
                      key: getKeyFromAuth(req),
                      provider: "github",
                      userId: approvetedUserId,
                      created: new Date(),
                    },
                    grant: {
                      ownerId: approvetedUserId,
                      on: new Date(),
                    },
                    tick: {
                      count: 1,
                      last: new Date(),
                    },
                  };
                } else {
                  grant = "pending-request";
                  entry = {
                    type: "app.acl.active.request",
                    role: "viewer",
                    state: "pending",
                    request: {
                      key: getKeyFromAuth(req),
                      provider: "github",
                      userId: approvetedUserId,
                      created: new Date(),
                    },
                  };
                }
                // request access
                const rEas = await ensureAppSettings(
                  vctx,
                  {
                    type: "vibes.diy.req-ensure-app-settings",
                    aclEntry: {
                      op: "upsert",
                      entry,
                    },
                    appSlug: app.appSlug,
                    userSlug: app.userSlug,
                  },
                  app.userId
                );
                if (rEas.isErr()) {
                  await ctx.send.send(ctx, {
                    type: "vibes.diy.res-get-app-by-fsid",
                    error: "ensure-app-settings-failed",
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
