import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  exception2Result,
  JSONEnDecoderSingleton,
} from "@adviser/cement";
import {
  MsgBase,
  reqListMemberships,
  ReqListMemberships,
  ReqWithVerifiedAuth,
  ResListMemberships,
  ResMembershipItem,
  VibesDiyError,
  W3CWebSocketEvent,
  ActiveEntry,
  isActiveIcon,
  isActiveTitle,
  Role,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { base58btc } from "multiformats/bases/base58";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, or } from "drizzle-orm/sql/expressions";
import { sql } from "drizzle-orm";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

const cursorShape = type({
  activityAt: "string",
  userSlug: "string",
  appSlug: "string",
});
type DecodedCursor = typeof cursorShape.infer;

const jsonEnde = JSONEnDecoderSingleton();

function encodeCursor(c: DecodedCursor): string {
  return base58btc.encode(jsonEnde.uint8ify(c));
}

function decodeCursor(raw: string): Result<DecodedCursor> {
  const rBytes = exception2Result(() => base58btc.decode(raw));
  if (rBytes.isErr()) return Result.Err(rBytes.Err());
  const rParsed = jsonEnde.parse<unknown>(rBytes.Ok());
  if (rParsed.isErr()) return Result.Err(rParsed.Err());
  const checked = cursorShape(rParsed.Ok());
  if (checked instanceof type.errors) {
    return Result.Err(`invalid cursor: ${checked.summary}`);
  }
  return Result.Ok(checked);
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  const i = Math.floor(raw);
  if (i < MIN_LIMIT) return MIN_LIMIT;
  if (i > MAX_LIMIT) return MAX_LIMIT;
  return i;
}

interface MergedApp {
  ownerUserId: string;
  ownerUserSlug: string;
  appSlug: string;
  role: Role;
  grantUpdated: string;
}

export const listMembershipsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListMemberships>,
  ResListMemberships | VibesDiyError
> = {
  hash: "list-memberships",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListMemberships(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqListMemberships>>, ResListMemberships | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const myUserId = req._auth.verifiedAuth.claims.userId;
      const limit = clampLimit(req.limit);
      const t = vctx.sql.tables;

      // Invites accepted by this user (tokenOrGrantUserId = myUserId after redemption).
      const inviteRows = await vctx.sql.db
        .select({
          ownerUserId: t.inviteGrants.userId,
          ownerUserSlug: t.inviteGrants.userSlug,
          appSlug: t.inviteGrants.appSlug,
          role: t.inviteGrants.role,
          grantUpdated: t.inviteGrants.updated,
        })
        .from(t.inviteGrants)
        .where(and(eq(t.inviteGrants.tokenOrGrantUserId, myUserId), eq(t.inviteGrants.state, "accepted")));

      // Requests approved for this user (foreignUserId is the requester's Clerk userId).
      const requestRows = await vctx.sql.db
        .select({
          ownerUserId: t.requestGrants.userId,
          ownerUserSlug: t.requestGrants.userSlug,
          appSlug: t.requestGrants.appSlug,
          role: t.requestGrants.role,
          grantUpdated: t.requestGrants.updated,
        })
        .from(t.requestGrants)
        .where(and(eq(t.requestGrants.foreignUserId, myUserId), eq(t.requestGrants.state, "approved")));

      // Merge, deduping by (ownerUserSlug, appSlug). On conflict, keep the
      // higher-privilege role and the later updated timestamp.
      const roleRank: Record<string, number> = { editor: 2, submitter: 1, viewer: 0 };
      const mergedMap = new Map<string, MergedApp>();
      for (const r of [...inviteRows, ...requestRows]) {
        const role = r.role as Role;
        if (role !== "editor" && role !== "viewer" && role !== "submitter") continue;
        const key = `${r.ownerUserSlug}/${r.appSlug}`;
        const existing = mergedMap.get(key);
        if (!existing) {
          mergedMap.set(key, {
            ownerUserId: r.ownerUserId,
            ownerUserSlug: r.ownerUserSlug,
            appSlug: r.appSlug,
            role,
            grantUpdated: r.grantUpdated,
          });
        } else {
          const keepRole = (roleRank[role] ?? -1) > (roleRank[existing.role] ?? -1) ? role : existing.role;
          const keepUpdated = r.grantUpdated > existing.grantUpdated ? r.grantUpdated : existing.grantUpdated;
          mergedMap.set(key, { ...existing, role: keepRole, grantUpdated: keepUpdated });
        }
      }

      const merged = [...mergedMap.values()];

      // Max AppDocuments write timestamp per (ownerUserSlug, appSlug) by this user.
      // AppDocuments.userSlug = owner's slug; .userId = writer's Clerk userId.
      const lastWriteMap = new Map<string, string>();
      if (merged.length > 0) {
        const appKeys = merged.map((m) => ({ userSlug: m.ownerUserSlug, appSlug: m.appSlug }));
        const conditions = appKeys.map((k) => and(eq(t.appDocuments.userSlug, k.userSlug), eq(t.appDocuments.appSlug, k.appSlug)));
        const [firstCondition, ...otherConditions] = conditions;
        if (firstCondition) {
          const orCondition = otherConditions.length === 0 ? firstCondition : or(firstCondition, ...otherConditions);
          const docRows = await vctx.sql.db
            .select({
              ownerUserSlug: t.appDocuments.userSlug,
              appSlug: t.appDocuments.appSlug,
              lastWrite: sql<string>`MAX(${t.appDocuments.created})`,
            })
            .from(t.appDocuments)
            .where(and(eq(t.appDocuments.userId, myUserId), orCondition))
            .groupBy(t.appDocuments.userSlug, t.appDocuments.appSlug);
          for (const row of docRows) {
            if (row.lastWrite) lastWriteMap.set(`${row.ownerUserSlug}/${row.appSlug}`, row.lastWrite);
          }
        }
      }

      // Compute activityAt = max(grantUpdated, lastDocWrite).
      type Sortable = MergedApp & { activityAt: string };
      const sortable: Sortable[] = merged.map((m) => {
        const lastWrite = lastWriteMap.get(`${m.ownerUserSlug}/${m.appSlug}`) ?? "";
        const activityAt = m.grantUpdated > lastWrite ? m.grantUpdated : lastWrite;
        return { ...m, activityAt };
      });

      // Sort by (activityAt DESC, ownerUserSlug DESC, appSlug DESC).
      sortable.sort((a, b) => {
        if (b.activityAt !== a.activityAt) return b.activityAt < a.activityAt ? -1 : 1;
        if (b.ownerUserSlug !== a.ownerUserSlug) return b.ownerUserSlug < a.ownerUserSlug ? -1 : 1;
        return b.appSlug < a.appSlug ? -1 : 1;
      });

      // Apply cursor: skip rows at/before cursor position using tuple predicate.
      let rows = sortable;
      if (req.cursor) {
        const rDecoded = decodeCursor(req.cursor);
        if (rDecoded.isErr()) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.error",
            message: `Invalid cursor: ${rDecoded.Err().message}`,
            code: "list-memberships-invalid-cursor",
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
        const c = rDecoded.Ok();
        rows = sortable.filter(
          (r) =>
            r.activityAt < c.activityAt ||
            (r.activityAt === c.activityAt && r.ownerUserSlug < c.userSlug) ||
            (r.activityAt === c.activityAt && r.ownerUserSlug === c.userSlug && r.appSlug < c.appSlug)
        );
      }

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      // Fetch AppSettings for this page to get title + icon.
      const settingsMap = new Map<string, ActiveEntry[]>();
      if (page.length > 0) {
        const settingsConds = page.map((p) => and(eq(t.appSettings.userId, p.ownerUserId), eq(t.appSettings.appSlug, p.appSlug)));
        const [firstSettingsCond, ...otherSettingsConds] = settingsConds;
        if (firstSettingsCond) {
          const settingsOrCond =
            otherSettingsConds.length === 0 ? firstSettingsCond : or(firstSettingsCond, ...otherSettingsConds);
          const settingsRows = await vctx.sql.db
            .select({ userId: t.appSettings.userId, appSlug: t.appSettings.appSlug, settings: t.appSettings.settings })
            .from(t.appSettings)
            .where(settingsOrCond);
          for (const s of settingsRows) {
            const entries = (s.settings as ActiveEntry[] | null) ?? [];
            settingsMap.set(`${s.userId}/${s.appSlug}`, entries);
          }
        }
      }

      const items: ResMembershipItem[] = page.map((p) => {
        const entries = settingsMap.get(`${p.ownerUserId}/${p.appSlug}`) ?? [];
        const titleEntry = entries.find(isActiveTitle);
        const iconEntry = entries.find(isActiveIcon);
        const head = iconEntry?.versions.find((v) => v.cid === iconEntry.currentCid);
        const icon = head && head.cid.length > 0 ? { cid: head.cid, mime: head.mime } : undefined;
        const item: ResMembershipItem = {
          userSlug: p.ownerUserSlug,
          appSlug: p.appSlug,
          activityAt: p.activityAt,
          role: p.role,
        };
        if (titleEntry) item.title = titleEntry.title;
        if (icon) item.icon = icon;
        return item;
      });

      const lastRow = hasMore ? page[page.length - 1] : undefined;
      const nextCursor = lastRow
        ? encodeCursor({ activityAt: lastRow.activityAt, userSlug: lastRow.ownerUserSlug, appSlug: lastRow.appSlug })
        : undefined;

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-memberships",
        items,
        ...(nextCursor ? { nextCursor } : {}),
      } satisfies ResListMemberships);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
