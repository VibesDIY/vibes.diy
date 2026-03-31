import { Result, exception2Result } from "@adviser/cement";
import {
  AIParams,
  ActiveEntry,
  isActiveModelSettingApp,
  isActiveModelSettingChat,
  isActiveModelSettingImg,
  isUserSettingModelDefaults,
  type ModelSelector,
  userSettingItem,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq, and } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";
import { loadModels } from "../public/list-models.js";

async function loadPreSelectedDefaults(ctx: VibesApiSQLCtx): Promise<Result<Record<ModelSelector, AIParams>>> {
  const rModels = await loadModels(ctx);
  if (rModels.isErr()) return Result.Err(rModels);
  const models = rModels.Ok().models;
  const usages: ModelSelector[] = ["chat", "app", "img"];
  const defaults = {} as Record<ModelSelector, AIParams>;
  for (const usage of usages) {
    const found = models.find((m) => m.preSelected?.includes(usage));
    if (!found) return Result.Err(`No preSelected model found for usage: ${usage}`);
    defaults[usage] = { model: found } satisfies AIParams;
  }
  return Result.Ok(defaults);
}

export interface ModelDefaults {
  chat: AIParams;
  app: AIParams;
  img: AIParams;
}

/**
 * Resolves model defaults for chat/app/img using a 3-tier fallback:
 *   1. appSettings (appSlug + userSlug required)
 *   2. userSettings (looked up via userSlug → userId)
 *   3. preSelected defaults from models.json (fails if not configured)
 *
 * Each field is resolved independently, so appSettings.chat can override
 * userSettings.chat while img still falls back to the global default.
 */
export async function getModelDefaults(
  ctx: VibesApiSQLCtx,
  { appSlug, userSlug }: { appSlug?: string; userSlug?: string }
): Promise<Result<ModelDefaults>> {
  // Tier 3: preSelected defaults from model catalog (lowest priority)
  const rDefaults = await loadPreSelectedDefaults(ctx);
  if (rDefaults.isErr()) return Result.Err(rDefaults);
  const result: ModelDefaults = { ...rDefaults.Ok() };

  // Tier 2: user-level model defaults
  if (userSlug) {
    const rBinding = await exception2Result(() =>
      ctx.sql.db
        .select()
        .from(ctx.sql.tables.userSlugBinding)
        .where(eq(ctx.sql.tables.userSlugBinding.userSlug, userSlug))
        .limit(1)
        .then((r) => r[0])
    );
    if (rBinding.isErr()) return Result.Err(rBinding);
    const binding = rBinding.Ok();
    if (binding) {
      const rUser = await exception2Result(() =>
        ctx.sql.db
          .select()
          .from(ctx.sql.tables.userSettings)
          .where(eq(ctx.sql.tables.userSettings.userId, binding.userId))
          .limit(1)
          .then((r) => r[0])
      );
      if (rUser.isErr()) return Result.Err(rUser);
      const userRow = rUser.Ok();
      if (userRow) {
        const settings = userSettingItem.array()(userRow.settings);
        if (!(settings instanceof type.errors)) {
          const modelDefaults = settings.find(isUserSettingModelDefaults);
          if (modelDefaults) {
            if (modelDefaults.chat?.model) result.chat = modelDefaults.chat as AIParams;
            if (modelDefaults.app?.model) result.app = modelDefaults.app as AIParams;
            if (modelDefaults.img?.model) result.img = modelDefaults.img as AIParams;
          }
        }
      }
    }
  }

  // Tier 1: app-level overrides (highest priority)
  if (appSlug && userSlug) {
    const rApp = await exception2Result(() =>
      ctx.sql.db
        .select()
        .from(ctx.sql.tables.appSettings)
        .where(and(eq(ctx.sql.tables.appSettings.appSlug, appSlug), eq(ctx.sql.tables.appSettings.userSlug, userSlug)))
        .limit(1)
        .then((r) => r[0])
    );
    if (rApp.isErr()) return Result.Err(rApp);
    const appRow = rApp.Ok();
    if (appRow) {
      const entries = ActiveEntry.array()(appRow.settings);
      if (!(entries instanceof type.errors)) {
        for (const e of entries) {
          if (isActiveModelSettingChat(e)) result.chat = e.param;
          else if (isActiveModelSettingApp(e)) result.app = e.param;
          else if (isActiveModelSettingImg(e)) result.img = e.param;
        }
      }
    }
  }

  return Result.Ok(result);
}
