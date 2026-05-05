import { exception2Result, Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm/sql/expressions";
import { ensureLogger } from "@fireproof/core-runtime";
import {
  ActiveEntry,
  ActiveIconDescription,
  ActiveSkills,
  ActiveTitle,
  EvtAppSetting,
  EvtIconGen,
  isActiveTitle,
  MsgBase,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { preAllocate } from "./pre-allocate.js";

export interface EnsureAppMetadataArgs {
  readonly userId: string;
  readonly userSlug: string;
  readonly appSlug: string;
  readonly prompt: string;
  // For audit / queue source attribution.
  readonly src: string;
}

export interface EnsureAppMetadataResult {
  readonly generated: boolean;
}

/**
 * Idempotently ensures (userSlug, appSlug) has metadata in AppSettings:
 * active.title, active.skills, active.icon-description, plus an enqueued
 * evt-icon-gen so the queue worker generates the icon PNG.
 *
 * Skips if an `active.title` entry already exists for the app — the chat
 * path and push path can both call this freely without double-spending an
 * LLM call.
 *
 * Failures are logged and swallowed: the caller (push handler or chat
 * handler) keeps working even if metadata generation fails. User just
 * sees the appSlug as title fallback until something later regenerates.
 */
export async function ensureAppMetadata(
  ctx: VibesApiSQLCtx,
  args: EnsureAppMetadataArgs
): Promise<Result<EnsureAppMetadataResult>> {
  const rExisting = await exception2Result(() =>
    ctx.sql.db
      .select()
      .from(ctx.sql.tables.appSettings)
      .where(and(eq(ctx.sql.tables.appSettings.userSlug, args.userSlug), eq(ctx.sql.tables.appSettings.appSlug, args.appSlug)))
      .limit(1)
      .then((r) => r[0])
  );
  if (rExisting.isErr()) {
    return Result.Err(`appSettings select failed: ${rExisting.Err()}`);
  }
  const existing = rExisting.Ok();
  const { filtered: existingEntries } = parseArrayWarning(existing?.settings ?? [], ActiveEntry);
  if (existingEntries.some(isActiveTitle)) {
    return Result.Ok({ generated: false });
  }

  const rPre = await preAllocate(ctx, { prompt: args.prompt });
  if (rPre.isErr()) {
    ensureLogger(ctx.sthis, "ensureAppMetadata")
      .Warn()
      .Any({ err: rPre.Err(), userSlug: args.userSlug, appSlug: args.appSlug })
      .Msg("preAllocate failed; skipping metadata generation");
    return Result.Ok({ generated: false });
  }
  const pre = rPre.Ok();
  const title = pre.pairs[0]?.title;
  const skills = pre.skills;
  const iconDescription = pre.iconDescription;

  const newEntries: ActiveEntry[] = [];
  if (title) newEntries.push({ type: "active.title", title } satisfies ActiveTitle);
  if (skills && skills.length > 0) newEntries.push({ type: "active.skills", skills } satisfies ActiveSkills);
  if (iconDescription)
    newEntries.push({ type: "active.icon-description", description: iconDescription } satisfies ActiveIconDescription);

  if (newEntries.length === 0) {
    return Result.Ok({ generated: false });
  }

  const now = new Date().toISOString();
  if (existing) {
    const merged: ActiveEntry[] = [...existingEntries, ...newEntries];
    const rUpd = await exception2Result(() =>
      ctx.sql.db
        .update(ctx.sql.tables.appSettings)
        .set({ settings: merged, updated: now })
        .where(and(eq(ctx.sql.tables.appSettings.userSlug, args.userSlug), eq(ctx.sql.tables.appSettings.appSlug, args.appSlug)))
    );
    if (rUpd.isErr()) {
      return Result.Err(`appSettings update failed: ${rUpd.Err()}`);
    }
  } else {
    const rIns = await exception2Result(() =>
      ctx.sql.db.insert(ctx.sql.tables.appSettings).values({
        userId: args.userId,
        userSlug: args.userSlug,
        appSlug: args.appSlug,
        settings: newEntries,
        updated: now,
        created: now,
      })
    );
    if (rIns.isErr()) {
      return Result.Err(`appSettings insert failed: ${rIns.Err()}`);
    }
  }

  await ctx.postQueue({
    payload: {
      type: "vibes.diy.evt-app-setting",
      userSlug: args.userSlug,
      appSlug: args.appSlug,
      settings: newEntries,
    },
    tid: "queue-event",
    src: args.src,
    dst: "vibes-service",
    ttl: 1,
  } satisfies MsgBase<EvtAppSetting>);

  if (iconDescription) {
    await ctx.postQueue({
      payload: {
        type: "vibes.diy.evt-icon-gen",
        userSlug: args.userSlug,
        appSlug: args.appSlug,
      },
      tid: "queue-event",
      src: args.src,
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtIconGen>);
  }

  return Result.Ok({ generated: true });
}
