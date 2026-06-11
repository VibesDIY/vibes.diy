import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import { WSSendProvider } from "../svc-ws-send-provider.js";
import {
  MsgBase,
  ReqWithOptionalAuth,
  VibesDiyError,
  ResError,
  W3CWebSocketEvent,
  ClerkClaim,
  isUserSettingProfile,
  type DbAcl,
  type AccessDescriptor,
  COMMENTS_DB_NAME,
  COMMENTS_DEFAULT_ACL,
} from "@vibes.diy/api-types";
import { ReqVibeWhoAmI, ResVibeWhoAmI, ViewerPayload, DocAccessLevel, isReqVibeWhoAmI } from "@vibes.diy/vibe-types";
import { and, eq } from "drizzle-orm";
import { GrantReduce, extractContribution } from "./grant-reduce.js";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { checkDocAccess } from "./access-helpers.js";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { resolveActiveHandle } from "./resolve-active-handle.js";
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
  adminMode?: boolean;
}

export interface ResolvedWhoAmI {
  viewer: ViewerPayload | null;
  access: DocAccessLevel;
  isOwner: boolean;
  dbAcls: Record<string, DbAcl> | undefined;
  grants: Record<string, { channels: string[]; publicChannels: string[]; roles: string[] }> | undefined;
}

async function resolveGrants(
  vctx: VibesApiSQLCtx,
  ownerUserSlug: string,
  appSlug: string,
  viewerSlug: string | undefined
): Promise<Record<string, { channels: string[]; publicChannels: string[]; roles: string[] }> | undefined> {
  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const afbRows = await vctx.sql.db
    .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, ownerUserSlug), eq(tAfb.appSlug, appSlug)));

  if (afbRows.length === 0) return undefined;

  // Build fnCid lookup: named bindings take precedence over wildcard ('*').
  // Collect all distinct fnCids for the single batched outputs query.
  let wildcardCid: string | undefined;
  const namedCids = new Map<string, string>();
  const allCids = new Set<string>();
  for (const afb of afbRows) {
    allCids.add(afb.accessFnCid);
    if (afb.dbName === "*") {
      wildcardCid = afb.accessFnCid;
    } else {
      namedCids.set(afb.dbName, afb.accessFnCid);
    }
  }

  // Single batched query: fetch all grant-bearing outputs for this app
  // across all relevant fnCids. Outputs are stored under concrete dbNames
  // even when the binding was wildcard.
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const storedOutputs = await vctx.sql.db
    .select({ dbName: tOutputs.dbName, docId: tOutputs.docId, fnCid: tOutputs.fnCid, output: tOutputs.output })
    .from(tOutputs)
    .where(and(eq(tOutputs.ownerHandle, ownerUserSlug), eq(tOutputs.appSlug, appSlug), eq(tOutputs.hasGrants, 1)));

  // Group outputs by concrete dbName, only including rows whose fnCid
  // matches the effective binding (named takes precedence over wildcard).
  const outputsByDb = new Map<string, { docId: string; output: string }[]>();
  for (const row of storedOutputs) {
    const effectiveCid = namedCids.get(row.dbName) ?? wildcardCid;
    if (row.fnCid !== effectiveCid) continue;
    let arr = outputsByDb.get(row.dbName);
    if (!arr) {
      arr = [];
      outputsByDb.set(row.dbName, arr);
    }
    arr.push(row);
  }

  const grants: Record<string, { channels: string[]; publicChannels: string[]; roles: string[] }> = {};

  for (const [dbName, rows] of outputsByDb) {
    const reduce = new GrantReduce();
    for (const row of rows) {
      reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
    }

    const channels = viewerSlug ? Array.from(reduce.resolveEffectiveChannels(viewerSlug)) : [];
    const publicChannels = Array.from(reduce.publicChannels);

    const roles: string[] = [];
    if (viewerSlug) {
      for (const [roleName, members] of reduce.effectiveMembers) {
        if (members.has(viewerSlug)) roles.push(roleName);
      }
    }

    grants[dbName] = { channels, publicChannels, roles };
  }

  return Object.keys(grants).length > 0 ? grants : undefined;
}

export async function resolveWhoAmI(vctx: VibesApiSQLCtx, args: ResolveWhoAmIArgs): Promise<Result<ResolvedWhoAmI>> {
  const { auth, appSlug, ownerUserSlug } = args;

  const viewerUserId = auth?.verifiedAuth.claims.userId;
  const { access, isOwner } = viewerUserId
    ? await checkDocAccess(vctx, viewerUserId, appSlug, ownerUserSlug, args.adminMode)
    : { access: "none" as DocAccessLevel, isOwner: false };

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
    const grants = await resolveGrants(vctx, ownerUserSlug, appSlug, undefined);
    return Result.Ok({ viewer: null, access, isOwner, dbAcls, grants });
  }

  if (!viewerUserId) {
    const grants = await resolveGrants(vctx, ownerUserSlug, appSlug, undefined);
    return Result.Ok({ viewer: null, access, isOwner, dbAcls, grants });
  }

  const userSettingsRow = await vctx.sql.db
    .select({ settings: vctx.sql.tables.userSettings.settings })
    .from(vctx.sql.tables.userSettings)
    .where(eq(vctx.sql.tables.userSettings.userId, viewerUserId))
    .limit(1)
    .then((r) => r[0]);

  let displayOverride: string | undefined;
  const items = (userSettingsRow?.settings as unknown[]) ?? [];
  for (const item of items) {
    if (isUserSettingProfile(item)) {
      if (item.displayName) displayOverride = item.displayName;
    }
  }

  // Shared resolver: defaultHandle setting wins, else any bound handle. The
  // document write path uses the same helper so the published handle and the
  // access-fn user handle cannot diverge for multi-handle users (#2275).
  const viewerSlug = await resolveActiveHandle(vctx, viewerUserId, items);

  if (!viewerSlug) {
    const grants = await resolveGrants(vctx, ownerUserSlug, appSlug, undefined);
    return Result.Ok({ viewer: null, access, isOwner, dbAcls, grants });
  }

  const displayName = displayOverride ?? deriveDisplayName(auth.verifiedAuth.claims);

  const grants = await resolveGrants(vctx, ownerUserSlug, appSlug, viewerSlug);

  return Result.Ok({
    viewer: { userHandle: viewerSlug, displayName },
    access,
    isOwner,
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

      const { appSlug, ownerHandle: ownerUserSlug, adminMode } = req;
      const rawSend = (ctx.send as unknown as { provider?: WSSendProvider }).provider;
      if (rawSend instanceof WSSendProvider) {
        rawSend.adminMode = adminMode === true;
      }
      const rRes = await resolveWhoAmI(vctx, {
        auth: req._auth,
        appSlug,
        ownerUserSlug,
        adminMode,
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
        ...(r.isOwner ? { isOwner: r.isOwner } : {}),
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants !== undefined ? { grants: r.grants } : {}),
      } satisfies ResVibeWhoAmI);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
