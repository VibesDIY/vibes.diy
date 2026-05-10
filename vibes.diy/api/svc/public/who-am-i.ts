import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqWithOptionalAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  ClerkClaim,
  isUserSettingProfile,
  isUserSettingDefaultUserSlug,
  type DbAcl,
} from "@vibes.diy/api-types";
import { ReqVibeWhoAmI, ResVibeWhoAmI, ViewerPayload, DocAccessLevel, isReqVibeWhoAmI } from "@vibes.diy/vibe-types";
import { eq } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { checkDocAccess } from "./access-helpers.js";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { VerifiedResult } from "@fireproof/core-types-protocols-dashboard";

// Same precedence as list-members.ts:deriveAuthorDisplay.
function deriveDisplayName(claims: ClerkClaim): string {
  const p = claims.params;
  if (p.nick !== undefined && p.nick.trim() !== "") return p.nick.trim();
  if (p.name !== null && p.name.trim() !== "") return p.name.trim();
  const composed = `${p.first} ${p.last}`.trim();
  if (composed !== "") return composed;
  return p.email;
}

export interface ResolveWhoAmIArgs {
  auth: VerifiedResult | undefined;
  appSlug: string;
  ownerUserSlug: string;
}

export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  dbAcls: Record<string, DbAcl> | undefined;
}

export async function resolveWhoAmI(vctx: VibesApiSQLCtx, args: ResolveWhoAmIArgs): Promise<Result<ResolvedWhoAmI>> {
  const { auth, appSlug, ownerUserSlug } = args;

  const viewerUserId = auth?.verifiedAuth.claims.userId;
  const access: DocAccessLevel = viewerUserId ? await checkDocAccess(vctx, viewerUserId, appSlug, ownerUserSlug) : "none";

  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    userSlug: ownerUserSlug,
    env: [],
  });
  if (rSettings.isErr()) return Result.Err(rSettings.Err());
  const dbAcls = rSettings.Ok().settings.entry.dbAcls;

  if (!auth) {
    return Result.Ok({ viewer: null, access, dbAcls });
  }

  if (!viewerUserId) {
    return Result.Ok({ viewer: null, access, dbAcls });
  }

  const userSettingsRow = await vctx.sql.db
    .select({ settings: vctx.sql.tables.userSettings.settings })
    .from(vctx.sql.tables.userSettings)
    .where(eq(vctx.sql.tables.userSettings.userId, viewerUserId))
    .limit(1)
    .then((r) => r[0]);

  let viewerSlug: string | undefined;
  let displayOverride: string | undefined;
  const items = (userSettingsRow?.settings as unknown[]) ?? [];
  for (const item of items) {
    if (isUserSettingDefaultUserSlug(item) && !viewerSlug) viewerSlug = item.userSlug;
    if (isUserSettingProfile(item)) {
      if (item.displayName) displayOverride = item.displayName;
    }
  }

  if (!viewerSlug) {
    const binding = await vctx.sql.db
      .select({ userSlug: vctx.sql.tables.userSlugBinding.userSlug })
      .from(vctx.sql.tables.userSlugBinding)
      .where(eq(vctx.sql.tables.userSlugBinding.userId, viewerUserId))
      .limit(1)
      .then((r) => r[0]);
    viewerSlug = binding?.userSlug;
  }

  if (!viewerSlug) {
    return Result.Ok({ viewer: null, access, dbAcls });
  }

  const displayName = displayOverride ?? deriveDisplayName(auth.verifiedAuth.claims);

  return Result.Ok({
    viewer: { userSlug: viewerSlug, displayName },
    access,
    dbAcls,
  });
}

// Evento handler — used by the iframe bridge in srv-sandbox.
export const whoAmIEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqVibeWhoAmI>, ResVibeWhoAmI | VibesDiyError> = {
  hash: "vibe.whoAmI",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (!isReqVibeWhoAmI(msg.payload)) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqVibeWhoAmI }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqVibeWhoAmI>>, ResVibeWhoAmI | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const { appSlug, userSlug: ownerUserSlug } = req;
      const rRes = await resolveWhoAmI(vctx, {
        auth: req._auth,
        appSlug,
        ownerUserSlug,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: rRes.Err().message },
        } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        type: "vibe.res.whoAmI",
        tid: req.tid,
        viewer: r.viewer,
        access: r.access,
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
      } satisfies ResVibeWhoAmI);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
