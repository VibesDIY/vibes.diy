import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";
import { exception2Result, Result } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import { ensureUserSlug, ensureAppSlug, getDefaultUserSlug, persistDefaultUserSlug } from "./ensure-slug-binding.js";
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

export async function ensureChatId(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqOpenChat>
): Promise<Result<EnsureChatIdPResult>> {
  let appSlug = "";
  let ownerHandle = "";
  let chatId: string | undefined;
  const userId = req._auth.verifiedAuth.claims.userId;

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
