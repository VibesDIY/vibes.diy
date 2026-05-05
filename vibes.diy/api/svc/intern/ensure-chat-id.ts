import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";
import { exception2Result, Result } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import { ensureUserSlug, ensureAppSlug, getDefaultUserSlug, persistDefaultUserSlug } from "./ensure-slug-binding.js";
import { preAllocate } from "./pre-allocate.js";
import {
  ActiveEntry,
  ActiveIconDescription,
  ActiveSkills,
  ActiveTitle,
  EvtAppSetting,
  EvtIconGen,
  MsgBase,
  ReqOpenChat,
  ReqWithVerifiedAuth,
} from "@vibes.diy/api-types";

interface EnsureChatIdPResult {
  appSlug: string;
  userSlug: string;
  chatId: string;
}

export async function ensureChatId(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqOpenChat>
): Promise<Result<EnsureChatIdPResult>> {
  let appSlug = "";
  let userSlug = "";
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
    userSlug = result[0].userSlug;
    chatId = result[0].chatId;
  } else {
    // Resolve userSlug: explicit → default → create new
    if (req.userSlug) {
      const resUser = await ensureUserSlug(ctx, req._auth.verifiedAuth.claims, { userId, userSlug: req.userSlug });
      if (resUser.isErr()) return Result.Err(`Failed to ensure userSlug: ${resUser.Err().message}`);
      userSlug = resUser.Ok().userSlug;
    } else {
      const resDefault = await getDefaultUserSlug(ctx, userId);
      if (resDefault.isErr()) return Result.Err(`Failed to get default userSlug: ${resDefault.Err().message}`);
      const defaultBinding = resDefault.Ok();
      if (defaultBinding) {
        userSlug = defaultBinding.userSlug;
      } else {
        const resNew = await ensureUserSlug(ctx, req._auth.verifiedAuth.claims, { userId });
        if (resNew.isErr()) return Result.Err(`Failed to ensure userSlug: ${resNew.Err().message}`);
        userSlug = resNew.Ok().userSlug;
        await persistDefaultUserSlug(ctx, userId, userSlug);
      }
    }

    // Look up existing chat by userSlug+appSlug if appSlug provided
    if (req.appSlug) {
      const reqAppSlug = req.appSlug;
      const rResult = await exception2Result(() =>
        ctx.sql.db
          .select()
          .from(ctx.sql.tables.chatContexts)
          .where(
            and(
              eq(ctx.sql.tables.chatContexts.userId, userId),
              eq(ctx.sql.tables.chatContexts.userSlug, userSlug),
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
      // Pre-allocation: when the caller passed a prompt and no appSlug, run one
      // LLM call to pick {skills, pairs: [{title, slug}] × 3}. Feed pairs to
      // ensureAppSlug so the URL slug reflects the prompt; persist the chosen
      // pair's title and the skill list into app_settings below.
      let preferredPairs: { title: string; slug: string }[] | undefined;
      let preAllocSkills: string[] | undefined;
      let preAllocIconDescription: string | undefined;
      if (req.prompt && !req.appSlug) {
        const rPre = await preAllocate(ctx, { prompt: req.prompt });
        if (rPre.isOk()) {
          preferredPairs = rPre.Ok().pairs;
          preAllocSkills = rPre.Ok().skills;
          preAllocIconDescription = rPre.Ok().iconDescription;
        } else {
          console.warn("preAllocate failed; falling through to random-words:", rPre.Err());
        }
      }

      const resApp = await ensureAppSlug(ctx, { userId, userSlug, appSlug: req.appSlug, preferredPairs });
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
        userSlug,
        created: new Date().toISOString(),
      });

      if (chosenTitle || preAllocSkills || preAllocIconDescription) {
        await writePreAllocActiveEntries(ctx, {
          userId,
          userSlug,
          appSlug,
          title: chosenTitle,
          skills: preAllocSkills,
          iconDescription: preAllocIconDescription,
        });
      }
    }
  }
  return Result.Ok({ appSlug, userSlug, chatId });
}

async function writePreAllocActiveEntries(
  ctx: VibesApiSQLCtx,
  {
    userId,
    userSlug,
    appSlug,
    title,
    skills,
    iconDescription,
  }: { userId: string; userSlug: string; appSlug: string; title?: string; skills?: string[]; iconDescription?: string }
): Promise<void> {
  const now = new Date().toISOString();
  const entries: ActiveEntry[] = [];
  if (title) {
    entries.push({ type: "active.title", title } satisfies ActiveTitle);
  }
  if (skills && skills.length > 0) {
    entries.push({ type: "active.skills", skills } satisfies ActiveSkills);
  }
  if (iconDescription) {
    entries.push({ type: "active.icon-description", description: iconDescription } satisfies ActiveIconDescription);
  }
  if (entries.length === 0) return;
  const rIns = await exception2Result(() =>
    ctx.sql.db.insert(ctx.sql.tables.appSettings).values({
      userId,
      userSlug,
      appSlug,
      settings: entries,
      updated: now,
      created: now,
    })
  );
  if (rIns.isErr()) {
    ensureLogger(ctx.sthis, "writePreAllocActiveEntries")
      .Error()
      .Any({ err: rIns.Err(), userSlug, appSlug })
      .Msg("appSettings insert failed; skipping evt-app-setting");
    return;
  }
  await ctx.postQueue({
    payload: {
      type: "vibes.diy.evt-app-setting",
      userSlug,
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
        userSlug,
        appSlug,
      },
      tid: "queue-event",
      src: "ensureChatId",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtIconGen>);
  }
}
