import { Result, exception2Result } from "@adviser/cement";
import { callAI } from "call-ai";
import { type } from "arktype";
import { ensureLogger } from "@fireproof/core-runtime";
import {
  getLlmCatalogNames,
  getThemeCatalogNames,
  makePreAllocUserMessage,
  preAllocParsed,
  preAllocSchema,
} from "@vibes.diy/prompts";
import { VibesApiSQLCtx } from "../types.js";
import { loadModels } from "../public/list-models.js";

export interface PreAllocateResult {
  skills: string[];
  pairs: { title: string; slug: string }[];
  iconDescription: string;
  theme?: string;
  enrichedPrompt?: string;
}

// Always thread useViewer's docs + import into every generated app. The LLM
// picks `skills` from the catalog based on the user prompt, but identity /
// `can("write")` gating is something every app should be able to reach for —
// not gated on whether the model perceives "sharing" in the prompt.
const ALWAYS_ON_SKILLS = ["use-viewer"] as const;

const PRE_ALLOC_TIMEOUT_MS = 8000;

/**
 * Pre-allocation LLM call: takes the user's initial prompt and asks one
 * structured call for {skills, pairs}. The caller hands pairs to
 * ensureAppSlug as preferredPairs, and persists the chosen title + skills
 * into app_settings.
 *
 * Model: resolved via loadModels → `preSelected: ["app"]` entry in
 * models.json (currently openai/gpt-5.4-mini). No user/app overrides;
 * pre-alloc stays deterministic across users.
 *
 * Timeout: racing against PRE_ALLOC_TIMEOUT_MS. On timeout or any error
 * the caller (ensureChatId) falls through to random-words slug + default
 * skills — the user sees a random slug instead of blocking.
 */
export async function preAllocate(vctx: VibesApiSQLCtx, { prompt }: { prompt: string }): Promise<Result<PreAllocateResult>> {
  return exception2Result(async (): Promise<Result<PreAllocateResult>> => {
    const rModels = await loadModels(vctx);
    if (rModels.isErr()) return Result.Err(rModels);
    const appDefault = rModels.Ok().models.find((m) => m.preSelected?.includes("app"));
    if (!appDefault) return Result.Err("no preSelected app model in catalog");

    const userMessage = await makePreAllocUserMessage(prompt);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`pre-alloc LLM call timed out after ${PRE_ALLOC_TIMEOUT_MS}ms`)), PRE_ALLOC_TIMEOUT_MS)
    );
    const rCall = await exception2Result(() =>
      Promise.race([
        callAI(userMessage, {
          model: appDefault.id,
          endpoint: vctx.params.llm.url,
          apiKey: vctx.params.llm.apiKey,
          // preAllocSchema is `as const`, so its `required` is readonly. call-ai's
          // Schema expects mutable string[] — copy at the boundary.
          schema: { ...preAllocSchema, required: [...preAllocSchema.required] },
        }),
        timeout,
      ])
    );
    if (rCall.isErr()) return Result.Err(rCall);
    const raw = rCall.Ok();
    if (typeof raw !== "string") {
      return Result.Err("pre-alloc callAI returned non-string (streaming not requested)");
    }

    const rParsed = exception2Result(() => JSON.parse(raw) as unknown);
    if (rParsed.isErr()) return Result.Err(`pre-alloc JSON parse failed: ${rParsed.Err()}`);

    const validated = preAllocParsed(rParsed.Ok());
    if (validated instanceof type.errors) {
      return Result.Err(`pre-alloc schema validation failed: ${validated.summary}`);
    }
    if (validated.pairs.length === 0) {
      return Result.Err("pre-alloc returned zero title/slug pairs");
    }

    const catalogNames = await getLlmCatalogNames();
    const validSkills: string[] = [];
    const droppedSkills: string[] = [];
    for (const s of validated.skills) {
      (catalogNames.has(s) ? validSkills : droppedSkills).push(s);
    }
    if (droppedSkills.length > 0) {
      ensureLogger(vctx.sthis, "preAllocate").Warn().Any({ droppedSkills, validSkills }).Msg("pre-alloc skills missed catalog");
    }
    for (const s of ALWAYS_ON_SKILLS) {
      if (catalogNames.has(s) && !validSkills.includes(s)) validSkills.push(s);
    }

    const themeNames = getThemeCatalogNames();
    let validatedTheme: string | undefined;
    if (validated.theme) {
      if (themeNames.has(validated.theme)) {
        validatedTheme = validated.theme;
      } else {
        ensureLogger(vctx.sthis, "preAllocate").Warn().Any({ droppedTheme: validated.theme }).Msg("pre-alloc theme missed catalog");
      }
    }

    const enrichedPrompt = typeof validated.enrichedPrompt === "string" ? validated.enrichedPrompt.trim() : "";

    return Result.Ok({
      skills: validSkills,
      pairs: validated.pairs.slice(0, 3),
      iconDescription: validated.iconDescription,
      theme: validatedTheme,
      enrichedPrompt: enrichedPrompt.length > 0 ? enrichedPrompt : undefined,
    });
  });
}
