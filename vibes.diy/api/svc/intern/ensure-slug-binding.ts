import { exception2Result, Result } from "@adviser/cement";
import { VibesApiSQLCtx } from "../api.js";
import { generate } from "random-words";
import { and, eq } from "drizzle-orm";
import { sqlAppSlugBinding, sqlUserSlugBinding } from "../sql/vibes-diy-api-schema.js";

export interface AppSlugBinding {
  userId: string;
  appSlug: string;
  userSlug: string;
}

export type AppSlugBindingParam = Omit<AppSlugBinding, "created" | "appSlug" | "userSlug"> &
  Partial<Pick<AppSlugBinding, "appSlug" | "userSlug">>;

async function writeUserSlugBinding(ctx: VibesApiSQLCtx, userId: string, userSlug: string): Promise<Result<string>> {
  return exception2Result(async (): Promise<Result<string>> => {
    const existing = await ctx.db.select().from(sqlUserSlugBinding).where(eq(sqlUserSlugBinding.userId, userId)).all();
    if (existing.length >= ctx.params.maxUserSlugPerUserId) {
      return Result.Err("maximum userSlug bindings reached for this userId");
    }
    await ctx.db
      .insert(sqlUserSlugBinding)
      .values({
        userId: userId,
        userSlug: userSlug,
        created: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .run();
    return Result.Ok(userSlug);
  });
}

export async function ensureUserSlug(ctx: VibesApiSQLCtx, binding: AppSlugBindingParam): Promise<Result<string>> {
  return exception2Result(async (): Promise<Result<string>> => {
    let userSlug: string | undefined = undefined;
    if (!binding.userSlug) {
      for (let attempts = 0; attempts < 5; attempts++) {
        const tryUserSlug = generate({
          exactly: 1,
          wordsPerString: 3,
          separator: "-",
        })[0];
        const existing = await ctx.db.select().from(sqlUserSlugBinding).where(eq(sqlUserSlugBinding.userSlug, tryUserSlug)).get();
        if (!existing) {
          userSlug = tryUserSlug;
          break;
        }
      }
      if (!userSlug) {
        return Result.Err("could not generate unique userSlug after 5 attempts");
      }
      return writeUserSlugBinding(ctx, binding.userId, userSlug);
    }
    // Check if slug exists (regardless of who owns it)
    const existingSlug = await ctx.db
      .select()
      .from(sqlUserSlugBinding)
      .where(eq(sqlUserSlugBinding.userSlug, binding.userSlug))
      .get();

    if (existingSlug) {
      // Slug exists - check ownership
      if (existingSlug.userId !== binding.userId) {
        return Result.Err("userSlug already claimed by another user");
      }
      // Current user owns it
      return Result.Ok(binding.userSlug);
    }
    // Slug not taken - claim it
    return writeUserSlugBinding(ctx, binding.userId, binding.userSlug);
  });
}

async function writeAppSlugBinding(
  ctx: VibesApiSQLCtx,
  userId: string,
  userSlug: string,
  appSlug: string
): Promise<Result<string>> {
  return exception2Result(async (): Promise<Result<string>> => {
    const existing = await ctx.db
      .select()
      .from(sqlUserSlugBinding)
      .innerJoin(sqlAppSlugBinding, eq(sqlUserSlugBinding.userSlug, sqlAppSlugBinding.userSlug))
      .where(eq(sqlUserSlugBinding.userId, userId))
      .all();
    if (existing.length >= ctx.params.maxAppSlugPerUserId) {
      return Result.Err("maximum appSlug bindings reached for this userId");
    }
    await ctx.db
      .insert(sqlAppSlugBinding)
      .values({
        appSlug,
        userSlug: userSlug,
        created: new Date().toISOString(),
      })
      .run();
    return Result.Ok(appSlug);
  });
}

export async function ensureAppSlug(
  ctx: VibesApiSQLCtx,
  binding: Omit<AppSlugBindingParam, "userSlug"> & { userSlug: string }
): Promise<Result<string>> {
  return exception2Result(async (): Promise<Result<string>> => {
    let appSlug: string | undefined = undefined;
    if (!binding.appSlug) {
      // should be a transaction but CF - oh well
      for (let attempts = 0; attempts < 5; attempts++) {
        const tryAppSlug = generate({
          exactly: 1,
          wordsPerString: 3,
          separator: "-",
        })[0];
        const existing = await ctx.db.select().from(sqlAppSlugBinding).where(eq(sqlAppSlugBinding.appSlug, tryAppSlug)).get();
        if (!existing) {
          appSlug = tryAppSlug;
          break;
        }
      }
      if (!appSlug) {
        return Result.Err("could not generate unique appSlug after 5 attempts");
      }
      return writeAppSlugBinding(ctx, binding.userId, binding.userSlug, appSlug);
    } else {
      const existing = await ctx.db
        .select()
        .from(sqlAppSlugBinding)
        .innerJoin(sqlUserSlugBinding, eq(sqlAppSlugBinding.userSlug, sqlUserSlugBinding.userSlug))
        .where(and(eq(sqlAppSlugBinding.appSlug, binding.appSlug)))
        .get();
      if (!existing) {
        return writeAppSlugBinding(ctx, binding.userId, binding.userSlug, binding.appSlug);
      }
      appSlug = binding.appSlug;
    }
    return Result.Ok(appSlug);
  });
}

export async function listUserSlugs(ctx: VibesApiSQLCtx, userId: string): Promise<Result<string[]>> {
  return exception2Result(async (): Promise<Result<string[]>> => {
    const slugs = await ctx.db
      .select({ userSlug: sqlUserSlugBinding.userSlug })
      .from(sqlUserSlugBinding)
      .where(eq(sqlUserSlugBinding.userId, userId))
      .all();
    return Result.Ok(slugs.map((s) => s.userSlug));
  });
}

export async function ensureSlugBinding(ctx: VibesApiSQLCtx, binding: AppSlugBindingParam): Promise<Result<AppSlugBinding>> {
  const rUserSlug = await ensureUserSlug(ctx, binding);
  if (rUserSlug.isErr()) {
    return Result.Err(rUserSlug);
  }
  const rAppSlug = await ensureAppSlug(ctx, {
    userId: binding.userId,
    userSlug: rUserSlug.Ok(),
    appSlug: binding.appSlug,
  });
  if (rAppSlug.isErr()) {
    return Result.Err(rAppSlug);
  }
  return Result.Ok({
    userId: binding.userId,
    appSlug: rAppSlug.Ok(),
    userSlug: rUserSlug.Ok(),
  });
}
