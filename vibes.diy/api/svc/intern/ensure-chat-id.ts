import { and, desc, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";
import { exception2Result, Result } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import {
  ensureUserSlug,
  ensureAppSlug,
  getDefaultUserSlug,
  persistDefaultUserSlug,
  toRFC2822_32ByteLength,
} from "./ensure-slug-binding.js";
import { preAllocate } from "./pre-allocate.js";
import {
  ActiveEntry,
  ActiveEnrichedPrompt,
  ActiveIconDescription,
  ActiveSkills,
  ActiveTheme,
  ActiveTitle,
  EvtAppSetting,
  EvtIconGen,
  MsgBase,
  ReqOpenChat,
  ReqWithVerifiedAuth,
} from "@vibes.diy/api-types";

/**
 * Deterministic, clearly-non-real identity used only when a dry-run caller has
 * no explicit handle and no default binding (a brand-new user). It is never
 * persisted and owns no data, so previewing against it leaks nothing and the
 * preview output reads as obviously synthetic. Exported so the prompt handler
 * can skip the owner-ownership check for it (it has no owner to compare).
 */
export const DRY_RUN_PLACEHOLDER_HANDLE = "dry-run-preview";
export const DRY_RUN_PLACEHOLDER_APP_SLUG = "dry-run-preview";

/**
 * Returns true when a new-chat creation should trigger the pre-allocation LLM
 * call (theme + skill + slug selection). Extracted for unit-testability.
 * Acts as a type guard so callers get `prompt: string` narrowing for free.
 */
export function preAllocEligible(req: {
  readonly prompt?: string;
  readonly appSlug?: string;
}): req is { readonly prompt: string; readonly appSlug?: string } {
  return req.prompt !== undefined && req.prompt.length > 0;
}

interface EnsureChatIdPResult {
  appSlug: string;
  ownerHandle: string;
  chatId: string;
}

/**
 * Persistence-free owner/app/chat resolution for dry-run (`generate`/`edit
 * --dry-run`). Resolves the owner handle read-only (explicit → default → first
 * owned handle → deterministic placeholder) and an app-slug (explicit →
 * placeholder). When an
 * app-slug is given and the caller already has a chat for it, the REAL chatId is
 * reused so the preview assembles against the app's real history/timeline (edit
 * fidelity); otherwise an ephemeral chatId is synthesized. Either way nothing is
 * written — no chatContexts row, no appSlugBinding. The caller threads the
 * returned ownerHandle/appSlug back to the prompt handler inline (see
 * reqCreationPromptChatSection), so a *new* dry-run never needs the
 * (non-existent) chatContexts row. (#2364, #2374)
 */
async function dryRunResolveChatId(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqOpenChat>
): Promise<Result<EnsureChatIdPResult>> {
  const userId = req._auth.verifiedAuth.claims.userId;

  let ownerHandle: string;
  if (req.ownerHandle) {
    const sanitized = toRFC2822_32ByteLength(req.ownerHandle);
    const rOwned = await dryRunHandleIsForeign(ctx, sanitized, userId);
    if (rOwned.isErr()) return Result.Err(rOwned);
    // A real `ensureUserSlug` would reject a handle owned by another user (and
    // create an unclaimed one). Dry-run can't write, but it must not preview
    // against a handle the caller doesn't own — else `generate --dry-run
    // --handle someone-else` would succeed where the real generate fails, and
    // would expose that owner's model defaults. An unclaimed handle is fine
    // (the real generate would claim it).
    if (rOwned.Ok()) {
      return Result.Err(`ownerHandle "${req.ownerHandle}" is owned by another user`);
    }
    ownerHandle = sanitized;
  } else {
    const rDefault = await getDefaultUserSlug(ctx, userId);
    const defaultBinding = rDefault.isOk() ? rDefault.Ok() : undefined;
    if (defaultBinding) {
      ownerHandle = defaultBinding.ownerHandle;
    } else {
      // No default-handle setting: fall back read-only to the user's first owned
      // handle — parity with the CLI `resolveHandle` list fallback the real edit
      // path uses, so an `edit --dry-run` without `--handle` (e.g. on an app
      // created under an explicit handle) still previews against the real app's
      // history instead of an ephemeral chat. Only a user who owns NO handle at
      // all falls through to the deterministic placeholder. Order by created
      // DESC to match `listUserSlugAppSlug` (which the CLI's list fallback reads
      // via `desc(handleBinding.created)`), so the chosen handle agrees with the
      // real edit path for multi-handle/no-default users. (#2374 review)
      const rFirst = await exception2Result(() =>
        ctx.sql.db
          .select({ handle: ctx.sql.tables.handleBinding.handle })
          .from(ctx.sql.tables.handleBinding)
          .where(eq(ctx.sql.tables.handleBinding.userId, userId))
          .orderBy(desc(ctx.sql.tables.handleBinding.created))
          .limit(1)
          .then((r) => r[0])
      );
      ownerHandle = rFirst.isOk() && rFirst.Ok() ? rFirst.Ok().handle : DRY_RUN_PLACEHOLDER_HANDLE;
    }
  }

  const appSlug = req.appSlug ? toRFC2822_32ByteLength(req.appSlug) : DRY_RUN_PLACEHOLDER_APP_SLUG;

  // Reuse an existing chat (read-only) so `edit --dry-run` previews against the
  // app's real history. Only when an app-slug was supplied; a fresh generate
  // (no slug) skips this and goes ephemeral.
  if (req.appSlug) {
    const rExisting = await exception2Result(() =>
      ctx.sql.db
        .select({ chatId: ctx.sql.tables.chatContexts.chatId })
        .from(ctx.sql.tables.chatContexts)
        .where(
          and(
            eq(ctx.sql.tables.chatContexts.userId, userId),
            eq(ctx.sql.tables.chatContexts.ownerHandle, ownerHandle),
            eq(ctx.sql.tables.chatContexts.appSlug, appSlug)
          )
        )
        .limit(1)
        .then((r) => r[0])
    );
    if (rExisting.isOk() && rExisting.Ok()) {
      return Result.Ok({ appSlug, ownerHandle, chatId: rExisting.Ok().chatId });
    }
  }

  // No existing chat (e.g. a chat-less app, or a fresh generate): synthesize an
  // ephemeral chatId and insert nothing.
  const chatId = ctx.sthis.nextId(12).str;
  return Result.Ok({ appSlug, ownerHandle, chatId });
}

/**
 * Read-only check: does `handle` resolve to a binding owned by a *different*
 * user than `userId`? The dry-run sentinel handle owns no data and is treated
 * as not-foreign. Shared by the openChat resolver and the prompt handler so
 * both reject a forged dry-run that names another user's handle. (#2364)
 */
export async function dryRunHandleIsForeign(ctx: VibesApiSQLCtx, handle: string, userId: string): Promise<Result<boolean>> {
  if (handle === DRY_RUN_PLACEHOLDER_HANDLE) return Result.Ok(false);
  return exception2Result(async () => {
    const existing = await ctx.sql.db
      .select({ userId: ctx.sql.tables.handleBinding.userId })
      .from(ctx.sql.tables.handleBinding)
      .where(eq(ctx.sql.tables.handleBinding.handle, handle))
      .limit(1)
      .then((r) => r[0]);
    return !!existing && existing.userId !== userId;
  });
}

export async function ensureChatId(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqOpenChat>
): Promise<Result<EnsureChatIdPResult>> {
  let appSlug = "";
  let ownerHandle = "";
  let chatId: string | undefined;
  const userId = req._auth.verifiedAuth.claims.userId;

  // Persistence-free dry-run path: only for new chats (no chatId). An existing
  // chatId is a real row, so resolution stays on the normal read path below.
  if (req.dryRun === true && !req.chatId) {
    return dryRunResolveChatId(ctx, req);
  }

  if (req.chatId) {
    const reqChatId = req.chatId;
    const rResult = await exception2Result(() =>
      ctx.sql.db
        .select()
        .from(ctx.sql.tables.chatContexts)
        .where(and(eq(ctx.sql.tables.chatContexts.chatId, reqChatId), eq(ctx.sql.tables.chatContexts.userId, userId)))
    );
    if (rResult.isErr()) {
      return Result.Err(`Failed to query existing chat: ${rResult.Err().message}`);
    }
    const result = rResult.Ok();
    if (result.length !== 1) {
      return Result.Err(`Chat ID ${req.chatId} not found`);
    }
    appSlug = result[0].appSlug;
    ownerHandle = result[0].ownerHandle;
    chatId = result[0].chatId;
  } else {
    // Resolve ownerHandle: explicit → default → create new
    if (req.ownerHandle) {
      const resUser = await ensureUserSlug(ctx, req._auth.verifiedAuth.claims, { userId, ownerHandle: req.ownerHandle });
      if (resUser.isErr()) return Result.Err(`Failed to ensure ownerHandle: ${resUser.Err().message}`);
      ownerHandle = resUser.Ok().ownerHandle;
    } else {
      const resDefault = await getDefaultUserSlug(ctx, userId);
      if (resDefault.isErr()) return Result.Err(`Failed to get default ownerHandle: ${resDefault.Err().message}`);
      const defaultBinding = resDefault.Ok();
      if (defaultBinding) {
        ownerHandle = defaultBinding.ownerHandle;
      } else {
        const resNew = await ensureUserSlug(ctx, req._auth.verifiedAuth.claims, { userId });
        if (resNew.isErr()) return Result.Err(`Failed to ensure ownerHandle: ${resNew.Err().message}`);
        ownerHandle = resNew.Ok().ownerHandle;
        await persistDefaultUserSlug(ctx, userId, ownerHandle);
      }
    }

    // Look up existing chat by ownerHandle+appSlug if appSlug provided
    if (req.appSlug) {
      const reqAppSlug = req.appSlug;
      const rResult = await exception2Result(() =>
        ctx.sql.db
          .select()
          .from(ctx.sql.tables.chatContexts)
          .where(
            and(
              eq(ctx.sql.tables.chatContexts.userId, userId),
              eq(ctx.sql.tables.chatContexts.ownerHandle, ownerHandle),
              eq(ctx.sql.tables.chatContexts.appSlug, reqAppSlug)
            )
          )
      );
      if (rResult.isOk() && rResult.Ok().length === 1) {
        const existing = rResult.Ok()[0];
        appSlug = existing.appSlug;
        chatId = existing.chatId;
      }
    }

    if (!chatId) {
      // Pre-allocation: when the caller passes a prompt, run one LLM call to
      // pick {skills, pairs: [{title, slug}] × 3, theme}. Feed pairs to
      // ensureAppSlug so the URL slug reflects the prompt; persist the chosen
      // pair's title, skills, and theme into app_settings below.
      let preferredPairs: { title: string; slug: string }[] | undefined;
      let preAllocSkills: string[] | undefined;
      let preAllocIconDescription: string | undefined;
      let preAllocTheme: string | undefined;
      let preAllocEnrichedPrompt: string | undefined;
      if (preAllocEligible(req)) {
        const rPre = await preAllocate(ctx, { prompt: req.prompt });
        if (rPre.isOk()) {
          preferredPairs = rPre.Ok().pairs;
          preAllocSkills = rPre.Ok().skills;
          preAllocIconDescription = rPre.Ok().iconDescription;
          preAllocTheme = rPre.Ok().theme;
          preAllocEnrichedPrompt = rPre.Ok().enrichedPrompt;
        } else {
          console.warn("preAllocate failed; falling through to random-words:", rPre.Err());
        }
      }

      const resApp = await ensureAppSlug(ctx, { userId, ownerHandle, appSlug: req.appSlug, preferredPairs });
      if (resApp.isErr()) {
        return Result.Err(`Failed to ensure appSlug: ${resApp.Err().message}`);
      }
      appSlug = resApp.Ok().appSlug;
      const chosenTitle = resApp.Ok().chosenTitle;
      chatId = ctx.sthis.nextId(12).str;
      await ctx.sql.db.insert(ctx.sql.tables.chatContexts).values({
        chatId,
        userId,
        appSlug,
        ownerHandle,
        created: new Date().toISOString(),
      });

      if (chosenTitle || preAllocSkills || preAllocIconDescription || preAllocTheme || preAllocEnrichedPrompt) {
        await writePreAllocActiveEntries(ctx, {
          userId,
          ownerHandle,
          appSlug,
          title: chosenTitle,
          skills: preAllocSkills,
          iconDescription: preAllocIconDescription,
          theme: preAllocTheme,
          enrichedPrompt: preAllocEnrichedPrompt,
        });
      }
    }
  }
  return Result.Ok({ appSlug, ownerHandle, chatId });
}

async function writePreAllocActiveEntries(
  ctx: VibesApiSQLCtx,
  {
    userId,
    ownerHandle,
    appSlug,
    title,
    skills,
    iconDescription,
    theme,
    enrichedPrompt,
  }: {
    userId: string;
    ownerHandle: string;
    appSlug: string;
    title?: string;
    skills?: string[];
    iconDescription?: string;
    theme?: string;
    enrichedPrompt?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const entries: ActiveEntry[] = [];
  if (title) {
    entries.push({ type: "active.title", title } satisfies ActiveTitle);
  }
  if (skills && skills.length > 0) {
    entries.push({ type: "active.skills", skills } satisfies ActiveSkills);
  }
  if (theme) {
    entries.push({ type: "active.theme", theme } satisfies ActiveTheme);
  }
  if (iconDescription) {
    entries.push({ type: "active.icon-description", description: iconDescription } satisfies ActiveIconDescription);
  }
  if (enrichedPrompt) {
    entries.push({ type: "active.enriched-prompt", enrichedPrompt } satisfies ActiveEnrichedPrompt);
  }
  if (entries.length === 0) return;
  const rIns = await exception2Result(() =>
    ctx.sql.db.insert(ctx.sql.tables.appSettings).values({
      userId,
      ownerHandle,
      appSlug,
      settings: entries,
      updated: now,
      created: now,
    })
  );
  if (rIns.isErr()) {
    ensureLogger(ctx.sthis, "writePreAllocActiveEntries")
      .Error()
      .Any({ err: rIns.Err(), ownerHandle, appSlug })
      .Msg("appSettings insert failed; skipping evt-app-setting");
    return;
  }
  await ctx.postQueue({
    payload: {
      type: "vibes.diy.evt-app-setting",
      ownerHandle,
      appSlug,
      settings: entries,
    },
    tid: "queue-event",
    src: "ensureChatId",
    dst: "vibes-service",
    ttl: 1,
  } satisfies MsgBase<EvtAppSetting>);
  if (iconDescription) {
    await ctx.postQueue({
      payload: {
        type: "vibes.diy.evt-icon-gen",
        ownerHandle,
        appSlug,
      },
      tid: "queue-event",
      src: "ensureChatId",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtIconGen>);
  }
}
