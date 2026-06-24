import { MetaItem } from "@vibes.diy/api-types";
import { emitNotification, EmitNotificationCtx } from "./emit-notification.js";

// The slice of an Apps row that the remix notifier reads. A real Apps
// `$inferSelect` (which carries `meta`, `ownerHandle`, `appSlug`, `userId`)
// satisfies this shape, so callers can pass the freshly-published/cloned row
// directly without reshaping.
export interface RemixAppRow {
  readonly userId: string;
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly meta: unknown;
}

/**
 * Notify the source vibe's owner that their vibe was remixed.
 *
 * Resolves the source owner from the remix app's `remix-of` meta entry — the
 * stable identity captured at fork time (`srcUserId`/`srcOwnerHandle`/
 * `srcAppSlug`). There is deliberately NO reverse `fsId` lookup: a source and
 * all its forks share the same `fsId`, so a row lookup would be ambiguous.
 *
 * Returns silently (no notification) when:
 *  - there is no `remix-of` entry (not a remix), or
 *  - the entry lacks `srcUserId` (legacy remix predating source-identity
 *    capture — forward-only, never retro-notified), or
 *  - `srcUserId === remixApp.userId` (self-remix).
 *
 * Dedupe is handled entirely by `emitNotification`'s unique `(userId,
 * dedupeKey)` index, so republishing the same remix is naturally once-only —
 * no AppSettings/meta flag is needed.
 */
export async function notifyRemixSourceOwner(qctx: EmitNotificationCtx, remixApp: RemixAppRow): Promise<void> {
  const meta = (remixApp.meta as MetaItem[] | undefined) ?? [];
  const remixOf = meta.find((m): m is Extract<MetaItem, { type: "remix-of" }> => m.type === "remix-of");
  if (!remixOf) return; // not a remix
  const { srcUserId, srcOwnerHandle, srcAppSlug } = remixOf;
  if (!srcUserId || !srcOwnerHandle || !srcAppSlug) return; // legacy / no target
  if (srcUserId === remixApp.userId) return; // self-remix

  await emitNotification(qctx, {
    userId: srcUserId,
    notificationType: "vibe-remixed",
    ownerHandle: srcOwnerHandle,
    appSlug: srcAppSlug,
    actorHandle: remixApp.ownerHandle,
    body: `@${remixApp.ownerHandle} remixed your vibe ${srcAppSlug}`,
    targetRef: { remixOwnerHandle: remixApp.ownerHandle, remixAppSlug: remixApp.appSlug },
    dedupeKey: `vibe-remixed:${remixApp.ownerHandle}/${remixApp.appSlug}`,
  });
}
