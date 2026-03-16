import { exception2Result, Result } from "@adviser/cement";
import { VibesApiSQLCtx } from "../types.js";
import { generate } from "random-words";
import { and, eq, sql } from "drizzle-orm";
import { sqlAppSlugBinding, sqlUserSlugBinding } from "../sql/vibes-diy-api-schema.js";
import {
  AppSlugOptUserSlug,
  AppSlugUserSlug,
  NeedOneAppSlugUserSlug,
  OptAppSlugOptUserSlug,
  OptAppSlugUserSlug,
} from "@vibes.diy/api-types";

export interface AppSlugBinding {
  userId: string;
  tenant: string;
  appSlug: string;
  ledger: string;
  userSlug: string;
}

export type AppSlugBindingParam = NeedOneAppSlugUserSlug & {
  userId: string;
};

async function writeUserSlugBinding(
  ctx: VibesApiSQLCtx,
  userId: string,
  userSlug: string
): Promise<
  Result<{
    userSlug: string;
    tenant: string;
  }>
> {
  return exception2Result(
    async (): Promise<
      Result<{
        userSlug: string;
        tenant: string;
      }>
    > => {
      const existing = await ctx.db.select().from(sqlUserSlugBinding).where(eq(sqlUserSlugBinding.userId, userId)).all();
      if (existing.length >= ctx.params.maxUserSlugPerUserId) {
        return Result.Err("maximum userSlug bindings reached for this userId");
      }
      const tenant = ctx.sthis.nextId(12).str;
      await ctx.db
        .insert(sqlUserSlugBinding)
        .values({
          userId,
          tenant,
          userSlug,
          created: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();
      return Result.Ok({
        userSlug,
        tenant,
      });
    }
  );
}

export async function ensureUserSlug(
  ctx: VibesApiSQLCtx,
  binding: (OptAppSlugOptUserSlug | OptAppSlugUserSlug | AppSlugOptUserSlug | AppSlugUserSlug) & { userId: string }
): Promise<
  Result<{
    userSlug: string;
    tenant: string;
  }>
> {
  return exception2Result(
    async (): Promise<
      Result<{
        userSlug: string;
        tenant: string;
      }>
    > => {
      let userSlug: string | undefined = undefined;
      if (!binding.userSlug) {
        for (let attempts = 0; attempts < 5; attempts++) {
          const tryUserSlug = generate({
            exactly: 1,
            wordsPerString: 3,
            separator: "-",
          })[0];
          if (tryUserSlug.length > 30) {
            continue;
          }
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
      const existing = await ctx.db
        .select()
        .from(sqlUserSlugBinding)
        .where(and(eq(sqlUserSlugBinding.userId, binding.userId), eq(sqlUserSlugBinding.userSlug, binding.userSlug)))
        .get();
      if (!existing) {
        return writeUserSlugBinding(ctx, binding.userId, binding.userSlug);
      }
      return Result.Ok({
        userSlug: existing.userSlug,
        tenant: existing.tenant,
      });
    }
  );
}

async function writeAppSlugBinding(
  ctx: VibesApiSQLCtx,
  userId: string,
  userSlug: string,
  appSlug: string
): Promise<
  Result<{
    ledger: string;
    appSlug: string;
  }>
> {
  return exception2Result(
    async (): Promise<
      Result<{
        ledger: string;
        appSlug: string;
      }>
    > => {
      const [{ count }] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(sqlUserSlugBinding)
        .innerJoin(sqlAppSlugBinding, eq(sqlUserSlugBinding.userSlug, sqlAppSlugBinding.userSlug))
        .where(eq(sqlUserSlugBinding.userId, userId));
      if (count >= ctx.params.maxAppSlugPerUserId) {
        return Result.Err("maximum appSlug bindings reached for this userId");
      }
      const ledger = ctx.sthis.nextId(12).str;
      await ctx.db
        .insert(sqlAppSlugBinding)
        .values({
          appSlug,
          userSlug,
          ledger,
          created: new Date().toISOString(),
        })
        .run();
      return Result.Ok({
        ledger,
        appSlug,
      });
    }
  );
}

export async function ensureAppSlug(
  ctx: VibesApiSQLCtx,
  binding: (OptAppSlugUserSlug | AppSlugUserSlug) & { userId: string }
): Promise<
  Result<{
    ledger: string;
    appSlug: string;
  }>
> {
  return exception2Result(
    async (): Promise<
      Result<{
        ledger: string;
        appSlug: string;
      }>
    > => {
      let appSlug: string | undefined = undefined;
      if (!binding.appSlug) {
        // should be a transaction but CF - oh well
        for (let attempts = 0; attempts < 5; attempts++) {
          const tryAppSlug = generate({
            exactly: 1,
            wordsPerString: 3,
            separator: "-",
          })[0];
          if (tryAppSlug.length > 30) {
            continue;
          }
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
        return Result.Ok({
          ledger: existing.AppSlugBindings.ledger,
          appSlug,
        });
      }
    }
  );
}

export async function ensureSlugBinding(
  ctx: VibesApiSQLCtx,
  binding: AppSlugBindingParam
): Promise<
  Result<{
    appSlug: string;
    ledger: string;
    userSlug: string;
    tenant: string;
    userId: string;
  }>
> {
  const rUserSlug = await ensureUserSlug(ctx, binding);
  if (rUserSlug.isErr()) {
    return Result.Err(rUserSlug);
  }
  const rAppSlug = await ensureAppSlug(ctx, {
    ...binding,
    userSlug: rUserSlug.Ok().userSlug,
  });
  if (rAppSlug.isErr()) {
    return Result.Err(rAppSlug);
  }
  return Result.Ok({
    ...rAppSlug.Ok(),
    userSlug: rUserSlug.Ok().userSlug,
    tenant: rUserSlug.Ok().tenant,
    appSlug: rAppSlug.Ok().appSlug,
    ledger: rAppSlug.Ok().ledger,
    userId: binding.userId,
  });
}
