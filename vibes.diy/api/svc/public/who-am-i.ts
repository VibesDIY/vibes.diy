import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqWithOptionalAuth,
  VibesDiyError,
  ResError,
  W3CWebSocketEvent,
  ClerkClaim,
  isUserSettingProfile,
  isUserSettingDefaultHandle,
  type DbAcl,
  COMMENTS_DB_NAME,
  COMMENTS_DEFAULT_ACL,
} from "@vibes.diy/api-types";
import { ReqVibeWhoAmI, ResVibeWhoAmI, ViewerPayload, DocAccessLevel, isReqVibeWhoAmI } from "@vibes.diy/vibe-types";
import { and, eq } from "drizzle-orm";
import { GrantReduce, extractContribution } from "./grant-reduce.js";
import type { AccessDescriptor } from "@vibes.diy/api-types";
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
  // Absolute origin (e.g. "https://vibes.diy") used to build viewer.avatarUrl.
  // Any trailing slashes are stripped so the resulting URL never contains "//u/".
  apiBaseUrl: string;
}

export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  dbAcls: Record<string, DbAcl> | undefined;
  grants: Record<string, { channels: string[]; roles: string[] }> | undefined;
}

async function resolveGrants(
  vctx: VibesApiSQLCtx,
  ownerUserSlug: string,
  appSlug: string,
  viewerSlug: string | undefined
): Promise<Record<string, { channels: string[]; roles: string[] }> | undefined> {
  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const afbRows = await vctx.sql.db
    .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
    .from(tAfb)
    .where(and(eq(tAfb.userSlug, ownerUserSlug), eq(tAfb.appSlug, appSlug)));

  if (afbRows.length === 0) return undefined;

  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const grants: Record<string, { channels: string[]; roles: string[] }> = {};

  for (const afb of afbRows) {
    const storedOutputs = await vctx.sql.db
      .select({ docId: tOutputs.docId, output: tOutputs.output })
      .from(tOutputs)
      .where(
        and(
          eq(tOutputs.userSlug, ownerUserSlug),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, afb.dbName),
          eq(tOutputs.fnCid, afb.accessFnCid),
          eq(tOutputs.hasGrants, 1)
        )
      );

    const reduce = new GrantReduce();
    for (const row of storedOutputs) {
      reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
    }

    const channels = viewerSlug ? Array.from(reduce.resolveEffectiveChannels(viewerSlug)) : [];
    const publicCh = Array.from(reduce.publicChannels);
    const allChannels = [...new Set([...channels, ...publicCh])];

    const roles: string[] = [];
    if (viewerSlug) {
      for (const [roleName, members] of reduce.effectiveMembers) {
        if (members.has(viewerSlug)) roles.push(roleName);
      }
    }

    grants[afb.dbName] = { channels: allChannels, roles };
  }

  return Object.keys(grants).length > 0 ? grants : undefined;
}

export async function resolveWhoAmI(vctx: VibesApiSQLCtx, args: ResolveWhoAmIArgs): Promise<Result<ResolvedWhoAmI>> {
  const { auth, appSlug, ownerUserSlug, apiBaseUrl } = args;
  const baseOrigin = apiBaseUrl.replace(/\/+$/, "");

  const viewerUserId = auth?.verifiedAuth.claims.userId;
  const access: DocAccessLevel = viewerUserId ? await checkDocAccess(vctx, viewerUserId, appSlug, ownerUserSlug) : "none";

  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    ownerHandle: ownerUserSlug,
    env: [],
  });
  if (rSettings.isErr()) return Result.Err(rSettings.Err());
  const rawDbAcls = rSettings.Ok().settings.entry.dbAcls;

  // Apply lazy defaults so client can() stays in lockstep with server resolveDbAcl.
  // When no explicit comments override is stored, the server grants members write/delete
  // via COMMENTS_DEFAULT_ACL. Mirror that here so can("write","comments") returns the
  // same answer the server would reach.
  // Note: COMMENTS_DEFAULT_ACL intentionally omits `read` — the server falls back to
  // canRead||isPublicReadable; the client does the same via its own canRead logic.
  const effectiveDbAcls: Record<string, DbAcl> = { ...rawDbAcls };
  if (!effectiveDbAcls[COMMENTS_DB_NAME]) {
    effectiveDbAcls[COMMENTS_DB_NAME] = COMMENTS_DEFAULT_ACL;
  }
  const dbAcls = effectiveDbAcls;

  if (!auth) {
    return Result.Ok({ viewer: null, access, dbAcls, grants: undefined });
  }

  if (!viewerUserId) {
    return Result.Ok({ viewer: null, access, dbAcls, grants: undefined });
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
    if (isUserSettingDefaultHandle(item) && !viewerSlug) viewerSlug = item.ownerHandle;
    if (isUserSettingProfile(item)) {
      if (item.displayName) displayOverride = item.displayName;
    }
  }

  if (!viewerSlug) {
    const binding = await vctx.sql.db
      .select({ handle: vctx.sql.tables.handleBinding.handle })
      .from(vctx.sql.tables.handleBinding)
      .where(eq(vctx.sql.tables.handleBinding.userId, viewerUserId))
      .limit(1)
      .then((r) => r[0]);
    viewerSlug = binding?.handle;
  }

  if (!viewerSlug) {
    return Result.Ok({ viewer: null, access, dbAcls, grants: undefined });
  }

  const displayName = displayOverride ?? deriveDisplayName(auth.verifiedAuth.claims);
  const avatarUrl = `${baseOrigin}/u/${encodeURIComponent(viewerSlug)}/avatar`;

  const grants = await resolveGrants(vctx, ownerUserSlug, appSlug, viewerSlug);

  return Result.Ok({
    viewer: { userHandle: viewerSlug, displayName, avatarUrl },
    access,
    dbAcls,
    grants,
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

      const { appSlug, ownerHandle: ownerUserSlug } = req;
      const rRes = await resolveWhoAmI(vctx, {
        auth: req._auth,
        appSlug,
        ownerUserSlug,
        apiBaseUrl: vctx.params.vibes.env.VIBES_DIY_PUBLIC_BASE_URL,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: rRes.Err().message },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        type: "vibe.res.whoAmI",
        tid: req.tid,
        viewer: r.viewer,
        access: r.access,
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants !== undefined ? { grants: r.grants } : {}),
      } satisfies ResVibeWhoAmI);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
