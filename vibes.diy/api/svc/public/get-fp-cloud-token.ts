import { EventoHandler, Result, HandleTriggerCtx, EventoResultType, Option, EventoResult } from "@adviser/cement";
import { VibesApiSQLCtx } from "../types.js";
import {
  MsgBase,
  VibesDiyError,
  W3CWebSocketEvent,
  ReqFPCloudToken,
  ResFPCloudToken,
  isReqFPCloudToken,
} from "@vibes.diy/api-types";
import { optAuth, ReqWithOptionalAuth } from "../check-auth.js";
import { unwrapMsgBase } from "../unwrap-msg-base.js";

import { createFPToken, getFPTokenContext } from "@fireproof/core-protocols-dashboard";
import { FPCloudClaimSchema } from "@fireproof/core-types-protocols-cloud";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { decodeJwt } from "jose";
/**
 * Get FP cloud token
 */
async function getFPCloudToken(ctx: VibesApiSQLCtx, req: ReqWithOptionalAuth<ReqFPCloudToken>): Promise<Result<ResFPCloudToken>> {
  // const binding = await getSlugBinding(ctx, req)

  const reqUserId = req.auth?.verifiedAuth.claims.userId;

  const rAppSettings = await ensureAppSettings(ctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug: req.appSlug,
    userSlug: req.userSlug,
  });
  if (rAppSettings.isErr()) {
    return Result.Err(rAppSettings);
  }
  const settings = rAppSettings.Ok();
  let grant: ResFPCloudToken["grant"] = "no-grant";

  if (settings.userId === reqUserId) {
    grant = "owner";
  } else {
    const entry = settings.settings.entry;
    if (entry.enableRequest) {
      const role = entry.request.approved.find((i) => i.grant.ownerId === reqUserId);
      if (role) {
        switch (role.role) {
          case "editor":
            grant = "request-editor";
            break;
          case "viewer":
          default:
            grant = "request-viewer";
        }
      }
    }
    const inviteEditor = entry.invite.editors.accepted.find((i) => i.grant.ownerId === reqUserId);
    if (grant === "no-grant" && inviteEditor) {
      grant = "invite-editor";
    }
    const inviteViewer = entry.invite.viewers.accepted.find((i) => i.grant.ownerId === reqUserId);
    if (grant === "no-grant" && inviteViewer) {
      grant = "invite-viewer";
    }

    if (grant === "no-grant" && settings.settings.entry.publicAccess) {
      grant = "public";
    }
  }
  if (grant === "no-grant") {
    return Result.Ok({
      type: "vibes.diy.res-fpcloud-token",
      grant,
    });
  }
  const rCtx = await getFPTokenContext(ctx.sthis, {
    ...ctx.fpCloud,
  });
  if (rCtx.isErr()) {
    return Result.Err(rCtx);
  }
  const fpCtx = rCtx.Ok();
  const now = new Date();
  const cloudToken = await createFPToken(fpCtx, {
    userId: settings.userId, // owner of the the sandbox
    tenants: [
      {
        id: rAppSettings.Ok().tenant,
        role: "owner", // for now, everyone with a token is an admin. We can add more granular roles later if needed.
      },
    ],
    ledgers: [
      {
        id: rAppSettings.Ok().ledger,
        role: "owner",
        right: "write",
      },
    ],
    email: `${req.appSlug}--${req.userSlug}--${req.dbName}@sand.box`,
    nickname: `${req.appSlug}--${req.userSlug}--${req.dbName}`,
    provider: "google", // "vibes.diy" as FPCloudClaim['provider'],
    created: now,
    selected: {
      appId: req.dbName,
      tenant: rAppSettings.Ok().tenant,
      ledger: rAppSettings.Ok().ledger,
    },
  });

  const claims = FPCloudClaimSchema.safeParse(decodeJwt(cloudToken.token));
  if (!claims.success) {
    return Result.Err(`failed to decode cloud token claims: ${claims.error.message}`);
  }

  // ResEnsureCloudToken
  // dashApi.ensureCloudToken

  return Result.Ok({
    type: "vibes.diy.res-fpcloud-token",
    token: {
      token: cloudToken.token,
      claims: claims.data,
      expiresInSec: 3600,
    },
    grant: grant, //as ResFPCloudTokenGrant['grant'],
    fpCloudUrl: ctx.fpCloud.url,
    appSlug: req.appSlug,
    userSlug: req.userSlug,
    dbName: req.dbName,
    tenant: rAppSettings.Ok().tenant,
    ledger: rAppSettings.Ok().ledger,
  } satisfies ResFPCloudToken);
}

export const getFPCloudTokenEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqFPCloudToken>, ResFPCloudToken | VibesDiyError> = {
  hash: "get-fp-cloud-token",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (!isReqFPCloudToken(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: msg.payload,
      })
    );
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqFPCloudToken>>, ResFPCloudToken | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const res = await getFPCloudToken(vctx, req);
      if (res.isErr()) {
        return Result.Err(res);
      }

      await ctx.send.send(ctx, res.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
