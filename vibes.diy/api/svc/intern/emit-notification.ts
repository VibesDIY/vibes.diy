import { and, eq } from "drizzle-orm/sql/expressions";
import { EmitNotificationInput, NotificationType } from "@vibes.diy/api-types";
import type { cfDrizzle, VibesApiTables } from "@vibes.diy/api-sql";
import type { SuperThis } from "@vibes.diy/identity";

// Structural slice of the ctx that emitNotification needs. Typing the param
// this way keeps the helper testable with a hand-built ctx while still
// accepting a real QueueCtx OR a VibesApiSQLCtx (both satisfy this shape).
//
// `notifyUser` is OPTIONAL and uses the 3-arg shape (`senderConnId` last) so
// that BOTH a `QueueCtx` (2-arg notifyUser — assignable because a function with
// fewer params satisfies a type expecting more) and a `VibesApiSQLCtx` (3-arg
// notifyUser, `senderConnId` required) match this structural slice. When the ctx
// has no notifyUser, the durable row is STILL inserted — only the live ping is
// skipped. `notificationType` uses the shared `NotificationType` enum so the
// VibesApiSQLCtx signature (which is enum-typed) assigns without widening.
export interface EmitNotificationCtx {
  readonly sthis: SuperThis;
  readonly sql: {
    db: ReturnType<typeof cfDrizzle>["db"];
    tables: VibesApiTables;
  };
  notifyUser?: (
    userId: string,
    evt: {
      type: "vibes.diy.evt-user-notification";
      notificationType: NotificationType;
      ownerHandle: string;
      appSlug: string;
    },
    senderConnId: string
  ) => Promise<void>;
}

/**
 * Single durable-emit path for notifications.
 *
 * 1. Insert a self-contained row, idempotent on (userId, dedupeKey) via
 *    onConflictDoNothing.
 * 2. If a row was actually inserted, fan out the live bell via notifyUser
 *    when the ctx provides one (the durable insert always happens regardless;
 *    a ctx without notifyUser persists the row but skips the live ping).
 * 3. If it was a duplicate (existing (userId, dedupeKey)), do nothing —
 *    neither persist nor re-ping — and return the existing row's id.
 *
 * The unique (userId, dedupeKey) index is the once-only guarantee.
 */
export async function emitNotification(
  qctx: EmitNotificationCtx,
  input: EmitNotificationInput
): Promise<{ inserted: boolean; id: string }> {
  const t = qctx.sql.tables.notifications;
  const id = qctx.sthis.nextId().str; // ULID-ish, sortable by creation
  const created = new Date().toISOString();

  const returned = await qctx.sql.db
    .insert(t)
    .values({
      id,
      userId: input.userId,
      notificationType: input.notificationType,
      ownerHandle: input.ownerHandle,
      appSlug: input.appSlug,
      body: input.body,
      actorHandle: input.actorHandle ?? null,
      actorUserId: input.actorUserId ?? null,
      targetRef: input.targetRef ?? null,
      dedupeKey: input.dedupeKey,
      created,
      readAt: null,
    })
    .onConflictDoNothing({ target: [t.userId, t.dedupeKey] })
    .returning({ id: t.id });

  const inserted = returned.length > 0;
  if (!inserted) {
    // Duplicate — resolve the existing row's id so callers can still reference
    // it, but do not re-ping the live bell.
    const existing = await qctx.sql.db
      .select({ id: t.id })
      .from(t)
      .where(and(eq(t.userId, input.userId), eq(t.dedupeKey, input.dedupeKey)))
      .limit(1)
      .then((r) => r[0]);
    return { inserted: false, id: existing?.id ?? id };
  }

  // Empty senderConnId = no originating connection to skip, so the live bell
  // fans out to all of the recipient's connections (correct for a
  // server-originated notification). A 2-arg QueueCtx.notifyUser ignores it.
  await qctx.notifyUser?.(
    input.userId,
    {
      type: "vibes.diy.evt-user-notification",
      notificationType: input.notificationType,
      ownerHandle: input.ownerHandle,
      appSlug: input.appSlug,
    },
    ""
  );

  return { inserted: true, id };
}
