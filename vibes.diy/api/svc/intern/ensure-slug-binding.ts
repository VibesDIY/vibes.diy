import { exception2Result, Result } from "@adviser/cement";
import { AppSlugBinding, AppUserSlugBinding, UserSlugBinding, VibesApiSQLCtx } from "../types.js";
import { generate } from "random-words";
import { and, eq } from "drizzle-orm/sql/expressions";
import { sql } from "drizzle-orm/sql";
import {
  AppSlugOptUserSlug,
  AppSlugUserSlug,
  ClerkClaim,
  NeedOneAppSlugUserSlug,
  OptAppSlugOptUserSlug,
  OptAppSlugUserSlug,
  isUserSettingDefaultUserSlug,
  userSettingItem,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";

export type AppSlugBindingParam = Partial<NeedOneAppSlugUserSlug> & {
  userId: string;
  claims: ClerkClaim;
};

export async function writeUserSlugBinding(
  ctx: VibesApiSQLCtx,
  userId: string,
  userSlug: string
): Promise<Result<UserSlugBinding>> {
  return exception2Result(async (): Promise<Result<UserSlugBinding>> => {
    const existing = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.userSlugBinding)
      .where(eq(ctx.sql.tables.userSlugBinding.userId, userId));
    if (existing.length >= ctx.params.maxUserSlugPerUserId) {
      return Result.Err("maximum userSlug bindings reached for this userId");
    }
    const owned = existing.find((e) => e.userSlug === userSlug);
    if (owned) {
      return Result.Ok({
        type: "vibes.diy-user-slug-binding",
        userId,
        userSlug: owned.userSlug,
        tenant: owned.tenant,
      });
    }

    const owner = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.userSlugBinding)
      .where(eq(ctx.sql.tables.userSlugBinding.userSlug, userSlug))
      .limit(1)
      .then((r) => r[0]);
    if (owner) {
      if (owner.userId !== userId) {
        return Result.Err(`userSlug "${userSlug}" is owned by another user`);
      }
      return Result.Ok({
        type: "vibes.diy-user-slug-binding",
        userId,
        userSlug: owner.userSlug,
        tenant: owner.tenant,
      });
    }

    const tenant = ctx.sthis.nextId(12).str;
    try {
      await ctx.sql.db.insert(ctx.sql.tables.userSlugBinding).values({
        userId,
        tenant,
        userSlug,
        created: new Date().toISOString(),
      });
    } catch (e) {
      const afterOwner = await ctx.sql.db
        .select()
        .from(ctx.sql.tables.userSlugBinding)
        .where(eq(ctx.sql.tables.userSlugBinding.userSlug, userSlug))
        .limit(1)
        .then((r) => r[0]);
      if (afterOwner) {
        if (afterOwner.userId !== userId) {
          return Result.Err(`userSlug "${userSlug}" is owned by another user`);
        }
        return Result.Ok({
          type: "vibes.diy-user-slug-binding",
          userId,
          userSlug: afterOwner.userSlug,
          tenant: afterOwner.tenant,
        });
      }
      throw e;
    }
    // .onConflictDoNothing();
    return Result.Ok({
      type: "vibes.diy-user-slug-binding",
      userId,
      userSlug,
      tenant,
    });
  });
}

function userSlugFromClaims(claims: ClerkClaim): string[] {
  const result: string[] = [];
  if (claims.params.nick) {
    result.push(claims.params.nick);
  }
  if (claims.params.email) {
    result.push(claims.params.email.replace(/@[^@]+$/, ""));
  }
  if (claims.params.name) {
    result.push(claims.params.name);
  }
  if (claims.params.first && claims.params.last) {
    result.push(`${claims.params.first} ${claims.params.last}`);
  }
  if (claims.params.first) {
    result.push(claims.params.first);
  }
  if (claims.params.last) {
    result.push(claims.params.last);
  }
  return result;
}

export async function ensureUserSlug(
  ctx: VibesApiSQLCtx,
  claims: ClerkClaim,
  binding: (OptAppSlugOptUserSlug | OptAppSlugUserSlug | AppSlugOptUserSlug | AppSlugUserSlug) & { userId: string }
): Promise<Result<UserSlugBinding>> {
  return exception2Result(async (): Promise<Result<UserSlugBinding>> => {
    let userSlug: string | undefined = undefined;
    if (!binding.userSlug) {
      const userSlugCandidates = [
        ...userSlugFromClaims(claims),
        ...new Array(5).fill(0).map(() => generate({ exactly: 1, wordsPerString: 3, separator: "-" })[0]),
      ];
      for (const tryUserSlug of userSlugCandidates) {
        const sanitizedAppSlug = toRFC2822_32ByteLength(tryUserSlug);
        if (!sanitizedAppSlug) {
          continue;
        }
        const existing = await ctx.sql.db
          .select()
          .from(ctx.sql.tables.userSlugBinding)
          .where(eq(ctx.sql.tables.userSlugBinding.userSlug, tryUserSlug))
          .limit(1)
          .then((r) => r[0]);
        if (!existing) {
          userSlug = sanitizedAppSlug;
          break;
        }
      }
      if (!userSlug) {
        return Result.Err("could not generate unique userSlug after 5 attempts");
      }
      // console.log("not-given-userSlug binding:", binding, userSlug);
      return writeUserSlugBinding(ctx, binding.userId, userSlug);
    }
    const sanitizedUserSlug = toRFC2822_32ByteLength(binding.userSlug);
    const existing = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.userSlugBinding)
      .where(
        and(
          eq(ctx.sql.tables.userSlugBinding.userId, binding.userId),
          eq(ctx.sql.tables.userSlugBinding.userSlug, sanitizedUserSlug)
        )
      )
      .limit(1)
      .then((r) => r[0]);
    if (!existing) {
      // console.log("given-userSlug no existing binding:", binding.userSlug, sanitizedUserSlug);
      return writeUserSlugBinding(ctx, binding.userId, sanitizedUserSlug);
    }
    // console.log("given-userSlug binding:", binding, existing);
    return Result.Ok({
      type: "vibes.diy-user-slug-binding",
      userId: binding.userId,
      userSlug: existing.userSlug,
      tenant: existing.tenant,
    });
  });
}

async function writeAppSlugBinding(
  ctx: VibesApiSQLCtx,
  userId: string,
  userSlug: string,
  appSlug: string
): Promise<Result<AppSlugBinding>> {
  return exception2Result(async (): Promise<Result<AppSlugBinding>> => {
    const [{ count }] = await ctx.sql.db
      .select({ count: sql<number>`count(*)` })
      .from(ctx.sql.tables.userSlugBinding)
      .innerJoin(ctx.sql.tables.appSlugBinding, eq(ctx.sql.tables.userSlugBinding.userSlug, ctx.sql.tables.appSlugBinding.userSlug))
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
      type: "vibes.diy-app-slug-binding",
      userId,
      ledger,
      appSlug,
    });
  });
}

export async function ensureAppSlug(
  ctx: VibesApiSQLCtx,
  binding: (OptAppSlugUserSlug | AppSlugUserSlug) & { userId: string }
): Promise<Result<AppSlugBinding>> {
  return exception2Result(async (): Promise<Result<AppSlugBinding>> => {
    let appSlug: string | undefined = undefined;
    if (!binding.appSlug) {
      // should be a transaction but CF - oh well
      for (let attempts = 0; attempts < 5; attempts++) {
        const tryAppSlug = generate({
          exactly: 1,
          wordsPerString: 3,
          separator: "-",
        })[0];
        const sanitizedAppSlug = toRFC2822_32ByteLength(tryAppSlug);
        if (!sanitizedAppSlug) {
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
      const sanitizedAppSlug = toRFC2822_32ByteLength(binding.appSlug);
      const existing = await ctx.sql.db
        .select()
        .from(ctx.sql.tables.appSlugBinding)
        .innerJoin(
          ctx.sql.tables.userSlugBinding,
          eq(ctx.sql.tables.appSlugBinding.userSlug, ctx.sql.tables.userSlugBinding.userSlug)
        )
        .where(and(eq(ctx.sql.tables.appSlugBinding.appSlug, sanitizedAppSlug)))
        .limit(1)
        .then((r) => r[0]);
      if (!existing) {
        return writeAppSlugBinding(ctx, binding.userId, binding.userSlug, sanitizedAppSlug);
      }
      // appSlug = binding.appSlug;
      return Result.Ok({
        type: "vibes.diy-app-slug-binding",
        userId: binding.userId,
        ledger: existing.AppSlugBindings.ledger,
        appSlug: sanitizedAppSlug,
      });
    }
  });
}

export async function getDefaultUserSlug(ctx: VibesApiSQLCtx, userId: string): Promise<Result<UserSlugBinding | undefined>> {
  return exception2Result(async (): Promise<Result<UserSlugBinding | undefined>> => {
    const existing = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.userSettings)
      .where(eq(ctx.sql.tables.userSettings.userId, userId))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) return Result.Ok(undefined);

    const { filtered: parsedSettings, warning: parsedWarning } = parseArrayWarning(existing.settings, userSettingItem);
    if (parsedWarning.length > 0) {
      ensureLogger(ctx.sthis, "getDefaultUserSlug").Warn().Any({ parseErrors: parsedWarning }).Msg("skip");
    }
    const def = parsedSettings.filter(isUserSettingDefaultUserSlug)[0];
    if (!def) return Result.Ok(undefined);

    const binding = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.userSlugBinding)
      .where(and(eq(ctx.sql.tables.userSlugBinding.userId, userId), eq(ctx.sql.tables.userSlugBinding.userSlug, def.userSlug)))
      .limit(1)
      .then((r) => r[0]);

    if (!binding) return Result.Ok(undefined);
    return Result.Ok({ type: "vibes.diy-user-slug-binding", userId, userSlug: binding.userSlug, tenant: binding.tenant });
  });
}

export async function persistDefaultUserSlug(ctx: VibesApiSQLCtx, userId: string, userSlug: string): Promise<void> {
  const now = new Date().toISOString();
  const newSetting = { type: "defaultUserSlug" as const, userSlug };
  const existing = await ctx.sql.db
    .select()
    .from(ctx.sql.tables.userSettings)
    .where(eq(ctx.sql.tables.userSettings.userId, userId))
    .limit(1)
    .then((r) => r[0]);
  if (!existing) {
    await ctx.sql.db.insert(ctx.sql.tables.userSettings).values({ userId, settings: [newSetting], updated: now, created: now });
  } else {
    const { filtered: currentParsed, warning: currentWarning } = parseArrayWarning(existing.settings, userSettingItem);
    if (currentWarning.length > 0) {
      ensureLogger(ctx.sthis, "persistDefaultUserSlug").Warn().Any({ parseErrors: currentWarning }).Msg("skip");
    }
    const current = currentParsed.filter((s) => s.type !== "defaultUserSlug");
    await ctx.sql.db
      .update(ctx.sql.tables.userSettings)
      .set({ settings: [...current, newSetting], updated: now })
      .where(eq(ctx.sql.tables.userSettings.userId, userId));
  }
}

export async function ensureSlugBinding(ctx: VibesApiSQLCtx, binding: AppSlugBindingParam): Promise<Result<AppUserSlugBinding>> {
  // console.log("ensureSlugBinding pre", binding.userSlug, binding.appSlug);
  const rUserSlug = await ensureUserSlug(ctx, binding.claims, binding);
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
  // console.log("ensureSlugBinding success",
  //   binding.userSlug, '===', rUserSlug.Ok().userSlug,
  //   binding.appSlug, '===', rAppSlug.Ok().appSlug);
  return Result.Ok({
    type: "vibes.diy-app-user-slug-binding",
    userSlug: rUserSlug.Ok(),
    appSlug: rAppSlug.Ok(),
  });
}

export function toRFC2822_32ByteLength(slug: string): string {
  // if (!slug) return undefined;

  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

//  const sanitizedAppSlug = toRFC2822_32ByteLength(req.appSlug);
//   const sanitizedUserSlug = toRFC2822_32ByteLength(req.userSlug);

//   if (sanitizedAppSlug !== req.appSlug) {
//     return Result.Ok({
//       type: "vibes.diy.error",
//       message: `appSlug "${req.appSlug}" is invalid.
//         It must be 32 characters or less, contain only lowercase letters,
//         numbers, and hyphens, and cannot start or end with a hyphen.
//         Suggested slug: "${sanitizedAppSlug}"`,
//       code: "app-slug-invalid",
//     } satisfies ResEnsureAppSlugError);
//   }

//   if (sanitizedUserSlug !== req.userSlug) {
//     return Result.Ok({
//       type: "vibes.diy.error",
//       message: `userSlug "${req.userSlug}" is invalid.
//         It must be 32 characters or less, contain only lowercase letters,
//         numbers, and hyphens, and cannot start or end with a hyphen.
//         Suggested slug: "${sanitizedUserSlug}"`,
//       code: "user-slug-invalid",
//     } satisfies ResEnsureAppSlugError);
//   }
