import { exception2Result, Result } from "@adviser/cement";
import { AppSlugBinding, AppHandleBinding, HandleBinding, VibesApiSQLCtx } from "../types.js";
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
  isUserSettingDefaultHandle,
  userSettingItem,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";

export type AppSlugBindingParam = Partial<NeedOneAppSlugUserSlug> & {
  userId: string;
  claims: ClerkClaim;
};

export async function writeHandleBinding(ctx: VibesApiSQLCtx, userId: string, ownerHandle: string): Promise<Result<HandleBinding>> {
  return exception2Result(async (): Promise<Result<HandleBinding>> => {
    const existing = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.handleBinding)
      .where(eq(ctx.sql.tables.handleBinding.userId, userId));
    const owned = existing.find((e) => e.handle === ownerHandle);
    if (owned) {
      return Result.Ok({
        type: "vibes.diy-user-slug-binding",
        userId,
        ownerHandle: owned.handle,
        tenant: owned.tenant,
      });
    }
    if (existing.length >= ctx.params.maxUserSlugPerUserId) {
      return Result.Err("maximum ownerHandle bindings reached for this userId");
    }
    const tenant = ctx.sthis.nextId(12).str;
    await ctx.sql.db
      .insert(ctx.sql.tables.handleBinding)
      .values({
        userId,
        tenant,
        handle: ownerHandle,
        created: new Date().toISOString(),
      })
      .onConflictDoNothing();
    // Post-insert verification: confirm our userId owns the row.
    // If another user won the race, the insert was a no-op and we reject.
    const owner = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.handleBinding)
      .where(eq(ctx.sql.tables.handleBinding.handle, ownerHandle))
      .limit(1)
      .then((r) => r[0]);
    if (!owner || owner.userId !== userId) {
      return Result.Err(`ownerHandle "${ownerHandle}" is owned by another user`);
    }
    return Result.Ok({
      type: "vibes.diy-user-slug-binding",
      userId,
      ownerHandle,
      tenant: owner.tenant,
    });
  });
}

function ownerHandleFromClaims(claims: ClerkClaim): string[] {
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
): Promise<Result<HandleBinding>> {
  return exception2Result(async (): Promise<Result<HandleBinding>> => {
    if (!binding.ownerHandle) {
      const existingForUser = await ctx.sql.db
        .select()
        .from(ctx.sql.tables.handleBinding)
        .where(eq(ctx.sql.tables.handleBinding.userId, binding.userId));
      if (existingForUser.length >= ctx.params.maxUserSlugPerUserId) {
        return Result.Err("maximum ownerHandle bindings reached for this userId");
      }
      const ownerHandleCandidates = [
        ...ownerHandleFromClaims(claims),
        ...new Array(5).fill(0).map(() => generate({ exactly: 1, wordsPerString: 3, separator: "-" })[0]),
      ];
      for (const tryUserSlug of ownerHandleCandidates) {
        const sanitizedUserSlug = toRFC2822_32ByteLength(tryUserSlug);
        if (!sanitizedUserSlug) {
          continue;
        }
        const existing = await ctx.sql.db
          .select()
          .from(ctx.sql.tables.handleBinding)
          .where(eq(ctx.sql.tables.handleBinding.handle, sanitizedUserSlug))
          .limit(1)
          .then((r) => r[0]);
        if (existing) {
          if (existing.userId === binding.userId) {
            return Result.Ok({
              type: "vibes.diy-user-slug-binding",
              userId: binding.userId,
              ownerHandle: existing.handle,
              tenant: existing.tenant,
            });
          }
          continue;
        }
        const rWrite = await writeHandleBinding(ctx, binding.userId, sanitizedUserSlug);
        if (rWrite.isOk()) return rWrite;
      }
      return Result.Err("could not generate unique ownerHandle after attempts");
    }
    const sanitizedUserSlug = toRFC2822_32ByteLength(binding.ownerHandle);
    const existing = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.handleBinding)
      .where(
        and(eq(ctx.sql.tables.handleBinding.userId, binding.userId), eq(ctx.sql.tables.handleBinding.handle, sanitizedUserSlug))
      )
      .limit(1)
      .then((r) => r[0]);
    if (!existing) {
      // console.log("given-ownerHandle no existing binding:", binding.ownerHandle, sanitizedUserSlug);
      return writeHandleBinding(ctx, binding.userId, sanitizedUserSlug);
    }
    // console.log("given-ownerHandle binding:", binding, existing);
    return Result.Ok({
      type: "vibes.diy-user-slug-binding",
      userId: binding.userId,
      ownerHandle: existing.handle,
      tenant: existing.tenant,
    });
  });
}

export async function writeAppSlugBinding(
  ctx: VibesApiSQLCtx,
  userId: string,
  ownerHandle: string,
  appSlug: string
): Promise<Result<AppSlugBinding>> {
  return exception2Result(async (): Promise<Result<AppSlugBinding>> => {
    const [{ count }] = await ctx.sql.db
      .select({ count: sql<number>`count(*)` })
      .from(ctx.sql.tables.handleBinding)
      .innerJoin(ctx.sql.tables.appSlugBinding, eq(ctx.sql.tables.handleBinding.handle, ctx.sql.tables.appSlugBinding.ownerHandle))
      .where(eq(ctx.sql.tables.handleBinding.userId, userId));
    if (count >= ctx.params.maxAppSlugPerUserId) {
      return Result.Err("maximum appSlug bindings reached for this userId");
    }
    const ledger = ctx.sthis.nextId(12).str;
    const now = new Date().toISOString();
    await ctx.sql.db.insert(ctx.sql.tables.appSlugBinding).values({
      appSlug,
      ownerHandle,
      ledger,
      created: now,
      updated: now,
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
  binding: (OptAppSlugUserSlug | AppSlugUserSlug) & {
    userId: string;
    preferredPairs?: { title: string; slug: string }[];
  }
): Promise<Result<AppSlugBinding & { chosenTitle?: string }>> {
  return exception2Result(async (): Promise<Result<AppSlugBinding & { chosenTitle?: string }>> => {
    if (!binding.appSlug) {
      const [{ count }] = await ctx.sql.db
        .select({ count: sql<number>`count(*)` })
        .from(ctx.sql.tables.handleBinding)
        .innerJoin(
          ctx.sql.tables.appSlugBinding,
          eq(ctx.sql.tables.handleBinding.handle, ctx.sql.tables.appSlugBinding.ownerHandle)
        )
        .where(eq(ctx.sql.tables.handleBinding.userId, binding.userId));
      if (count >= ctx.params.maxAppSlugPerUserId) {
        return Result.Err("maximum appSlug bindings reached for this userId");
      }
      const preferred: { slug: string; title?: string }[] = binding.preferredPairs ?? [];
      const randomAttempts = Math.max(0, 5 - preferred.length);
      const random: { slug: string; title?: string }[] = new Array(randomAttempts)
        .fill(0)
        .map(() => ({ slug: generate({ exactly: 1, wordsPerString: 3, separator: "-" })[0] }));
      const candidates = [...preferred, ...random];
      const attemptErrors: { slug: string; reason: string }[] = [];
      for (const candidate of candidates) {
        const sanitized = toRFC2822_32ByteLength(candidate.slug);
        if (!sanitized) {
          attemptErrors.push({ slug: candidate.slug, reason: "empty-after-sanitize" });
          continue;
        }
        const rExisting = await exception2Result(() =>
          ctx.sql.db
            .select()
            .from(ctx.sql.tables.appSlugBinding)
            .where(eq(ctx.sql.tables.appSlugBinding.appSlug, sanitized))
            .limit(1)
            .then((r) => r[0])
        );
        if (rExisting.isErr()) {
          attemptErrors.push({ slug: sanitized, reason: `existing-check-err: ${rExisting.Err().message}` });
          continue;
        }
        if (rExisting.Ok()) {
          attemptErrors.push({ slug: sanitized, reason: "collision" });
          continue;
        }
        const rWrite = await writeAppSlugBinding(ctx, binding.userId, binding.ownerHandle, sanitized);
        if (rWrite.isOk()) return Result.Ok({ ...rWrite.Ok(), chosenTitle: candidate.title });
        attemptErrors.push({ slug: sanitized, reason: `write-err: ${rWrite.Err().message}` });
      }
      ensureLogger(ctx.sthis, "ensureAppSlug")
        .Error()
        .Any({ userId: binding.userId, ownerHandle: binding.ownerHandle, attempts: attemptErrors })
        .Msg("all candidates failed");
      return Result.Err("could not generate unique appSlug after attempts");
    } else {
      const sanitizedAppSlug = toRFC2822_32ByteLength(binding.appSlug);
      // AppSlugBindings is keyed on (appSlug, ownerHandle); the same appSlug
      // may live under multiple ownerHandles. Filter on both so the caller's
      // binding is created when only another user owns the same appSlug.
      const existing = await ctx.sql.db
        .select()
        .from(ctx.sql.tables.appSlugBinding)
        .innerJoin(ctx.sql.tables.handleBinding, eq(ctx.sql.tables.appSlugBinding.ownerHandle, ctx.sql.tables.handleBinding.handle))
        .where(
          and(
            eq(ctx.sql.tables.appSlugBinding.appSlug, sanitizedAppSlug),
            eq(ctx.sql.tables.appSlugBinding.ownerHandle, binding.ownerHandle)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      if (!existing) {
        return writeAppSlugBinding(ctx, binding.userId, binding.ownerHandle, sanitizedAppSlug);
      }
      return Result.Ok({
        type: "vibes.diy-app-slug-binding",
        userId: binding.userId,
        ledger: existing.AppSlugBindings.ledger,
        appSlug: sanitizedAppSlug,
      });
    }
  });
}

export async function getDefaultUserSlug(ctx: VibesApiSQLCtx, userId: string): Promise<Result<HandleBinding | undefined>> {
  return exception2Result(async (): Promise<Result<HandleBinding | undefined>> => {
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
    const def = parsedSettings.filter(isUserSettingDefaultHandle)[0];
    if (!def) return Result.Ok(undefined);

    const binding = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.handleBinding)
      .where(and(eq(ctx.sql.tables.handleBinding.userId, userId), eq(ctx.sql.tables.handleBinding.handle, def.ownerHandle)))
      .limit(1)
      .then((r) => r[0]);

    if (!binding) return Result.Ok(undefined);
    return Result.Ok({ type: "vibes.diy-user-slug-binding", userId, ownerHandle: binding.handle, tenant: binding.tenant });
  });
}

export async function persistDefaultUserSlug(ctx: VibesApiSQLCtx, userId: string, ownerHandle: string): Promise<void> {
  const now = new Date().toISOString();
  const newSetting = { type: "defaultHandle" as const, ownerHandle };
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
    const current = currentParsed.filter((s) => s.type !== "defaultHandle");
    await ctx.sql.db
      .update(ctx.sql.tables.userSettings)
      .set({ settings: [...current, newSetting], updated: now })
      .where(eq(ctx.sql.tables.userSettings.userId, userId));
  }
}

export async function ensureSlugBinding(ctx: VibesApiSQLCtx, binding: AppSlugBindingParam): Promise<Result<AppHandleBinding>> {
  // console.log("ensureSlugBinding pre", binding.ownerHandle, binding.appSlug);
  const rUserSlug = await ensureUserSlug(ctx, binding.claims, binding);
  if (rUserSlug.isErr()) {
    return Result.Err(rUserSlug);
  }
  const rAppSlug = await ensureAppSlug(ctx, {
    ...binding,
    ownerHandle: rUserSlug.Ok().ownerHandle,
  });
  if (rAppSlug.isErr()) {
    return Result.Err(rAppSlug);
  }
  // console.log("ensureSlugBinding success",
  //   binding.ownerHandle, '===', rUserSlug.Ok().ownerHandle,
  //   binding.appSlug, '===', rAppSlug.Ok().appSlug);
  return Result.Ok({
    type: "vibes.diy-app-user-slug-binding",
    ownerHandle: rUserSlug.Ok(),
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
//   const sanitizedUserSlug = toRFC2822_32ByteLength(req.ownerHandle);

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

//   if (sanitizedUserSlug !== req.ownerHandle) {
//     return Result.Ok({
//       type: "vibes.diy.error",
//       message: `ownerHandle "${req.ownerHandle}" is invalid.
//         It must be 32 characters or less, contain only lowercase letters,
//         numbers, and hyphens, and cannot start or end with a hyphen.
//         Suggested slug: "${sanitizedUserSlug}"`,
//       code: "user-slug-invalid",
//     } satisfies ResEnsureAppSlugError);
//   }
