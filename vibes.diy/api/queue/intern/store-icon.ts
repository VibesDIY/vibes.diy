import { Result, exception2Result, uint8array2stream } from "@adviser/cement";
import { and, eq } from "drizzle-orm/sql/expressions";
import { createSQLPeer } from "@vibes.diy/api-sql";
import { ActiveEntry, ActiveIcon, IconVersion, isActiveIcon, parseArrayWarning } from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";
import { ensureStorage, StoragePeer } from "@vibes.diy/api-pkg";
import { createS3Peer } from "@vibes.diy/api-svc";
import { QueueCtx } from "../queue-ctx.js";

export interface StoreIconResult {
  readonly userSlug: string;
  readonly appSlug: string;
  readonly cid: string;
  readonly mime: string;
}

export async function storeIcon(
  qctx: QueueCtx,
  args: { userSlug: string; appSlug: string; bytes: Uint8Array; mime: string; description: string }
): Promise<Result<StoreIconResult>> {
  const { db, tables } = qctx.sql;

  const rRow = await exception2Result(() =>
    db
      .select()
      .from(tables.appSettings)
      .where(and(eq(tables.appSettings.userSlug, args.userSlug), eq(tables.appSettings.appSlug, args.appSlug)))
      .limit(1)
      .then((r) => r[0])
  );
  if (rRow.isErr()) return Result.Err(rRow);
  const row = rRow.Ok();
  if (!row) {
    return Result.Err(`appSettings row not found for ${args.userSlug}/${args.appSlug}`);
  }

  const peers: StoragePeer[] = [createSQLPeer(qctx.storageSystems.sql)];
  if (qctx.storageSystems.s3) {
    peers.push(createS3Peer({ s3: qctx.storageSystems.s3 }));
  }
  const [storageResult] = await ensureStorage(...peers).ensure(uint8array2stream(args.bytes));
  if (!storageResult || storageResult.isErr()) {
    return Result.Err(`Failed to store icon: ${storageResult?.Err()}`);
  }
  const cid = storageResult.Ok().getURL;

  const { filtered: entries, warning } = parseArrayWarning(row.settings ?? [], ActiveEntry);
  if (warning.length > 0) {
    ensureLogger(qctx.sthis, "storeIcon").Warn().Any({ parseErrors: warning }).Msg("skip");
  }

  const now = new Date().toISOString();
  const newVersion: IconVersion = {
    cid,
    mime: args.mime,
    descriptionAt: args.description,
    created: now,
  };

  const idx = entries.findIndex(isActiveIcon);
  if (idx >= 0) {
    const prev = entries[idx];
    if (isActiveIcon(prev)) {
      const next: ActiveIcon = {
        type: "active.icon",
        versions: [...prev.versions, newVersion],
        currentCid: cid,
      };
      entries[idx] = next;
    }
  } else {
    entries.push({
      type: "active.icon",
      versions: [newVersion],
      currentCid: cid,
    } satisfies ActiveIcon);
  }

  const rUpd = await exception2Result(() =>
    db
      .update(tables.appSettings)
      .set({ settings: entries, updated: now })
      .where(and(eq(tables.appSettings.userSlug, args.userSlug), eq(tables.appSettings.appSlug, args.appSlug)))
  );
  if (rUpd.isErr()) return Result.Err(rUpd);

  return Result.Ok({ userSlug: args.userSlug, appSlug: args.appSlug, cid, mime: args.mime });
}
