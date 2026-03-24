import { exception2Result, Result } from "@adviser/cement";
import { VibesApiSQLCtx } from "../types.js";
import { generate } from "random-words";
import { and, eq } from "drizzle-orm/sql/expressions";
import { sql } from "drizzle-orm/sql";
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
      const existing = await ctx.sql.db
        .select()
        .from(ctx.sql.tables.userSlugBinding)
        .where(eq(ctx.sql.tables.userSlugBinding.userId, userId));
      if (existing.length >= ctx.params.maxUserSlugPerUserId) {
        return Result.Err("maximum userSlug bindings reached for this userId");
      }
      const tenant = ctx.sthis.nextId(12).str;
      await ctx.sql.db
        .insert(ctx.sql.tables.userSlugBinding)
        .values({
          userId,
          tenant,
          userSlug,
          created: new Date().toISOString(),
        })
        .onConflictDoNothing();
      // Post-insert verification: confirm our userId owns the row.
      // If another user won the race, the insert was a no-op and we reject.
      const owner = await ctx.sql.db
        .select()
        .from(ctx.sql.tables.userSlugBinding)
        .where(eq(ctx.sql.tables.userSlugBinding.userSlug, userSlug))
        .limit(1)
        .then((r) => r[0]);
      if (!owner || owner.userId !== userId) {
        return Result.Err(`userSlug "${userSlug}" is owned by another user`);
      }
      return Result.Ok({
        userSlug,
        tenant: owner.tenant,
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
          const existing = await ctx.sql.db
            .select()
            .from(ctx.sql.tables.userSlugBinding)
            .where(eq(ctx.sql.tables.userSlugBinding.userSlug, tryUserSlug))
            .limit(1)
            .then((r) => r[0]);
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
      const existing = await ctx.sql.db
        .select()
        .from(ctx.sql.tables.userSlugBinding)
        .where(
          and(
            eq(ctx.sql.tables.userSlugBinding.userId, binding.userId),
            eq(ctx.sql.tables.userSlugBinding.userSlug, binding.userSlug)
          )
        )
        .limit(1)
        .then((r) => r[0]);
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
      const [{ count }] = await ctx.sql.db
        .select({ count: sql<number>`count(*)` })
        .from(ctx.sql.tables.userSlugBinding)
        .innerJoin(
          ctx.sql.tables.appSlugBinding,
          eq(ctx.sql.tables.userSlugBinding.userSlug, ctx.sql.tables.appSlugBinding.userSlug)
        )
        .where(eq(ctx.sql.tables.userSlugBinding.userId, userId));
      if (count >= ctx.params.maxAppSlugPerUserId) {
        return Result.Err("maximum appSlug bindings reached for this userId");
      }
      const ledger = ctx.sthis.nextId(12).str;
      await ctx.sql.db.insert(ctx.sql.tables.appSlugBinding).values({
        appSlug,
        userSlug,
        ledger,
        created: new Date().toISOString(),
      });
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
          const existing = await ctx.sql.db
            .select()
            .from(ctx.sql.tables.appSlugBinding)
            .where(eq(ctx.sql.tables.appSlugBinding.appSlug, tryAppSlug))
            .limit(1)
            .then((r) => r[0]);
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
        const existing = await ctx.sql.db
          .select()
          .from(ctx.sql.tables.appSlugBinding)
          .innerJoin(
            ctx.sql.tables.userSlugBinding,
            eq(ctx.sql.tables.appSlugBinding.userSlug, ctx.sql.tables.userSlugBinding.userSlug)
          )
          .where(and(eq(ctx.sql.tables.appSlugBinding.appSlug, binding.appSlug)))
          .limit(1)
          .then((r) => r[0]);
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
