import { Result, exception2Result } from "@adviser/cement";
import { callAI } from "call-ai";
import { type } from "arktype";
import { VibesApiSQLCtx } from "../types.js";
import { loadModels } from "../public/list-models.js";

export interface PreAllocateResult {
  skills: string[];
  pairs: { title: string; slug: string }[];
}

const preAllocParsed = type({
  skills: type("string").array(),
  pairs: type({ title: "string", slug: "string" }).array(),
});

const preAllocSchema = {
  name: "pre_alloc",
  properties: {
    skills: {
      type: "array",
      description: "Selected capability names from the catalog, appropriate for the app described by the prompt.",
      items: { type: "string" },
    },
    pairs: {
      type: "array",
      description: "Exactly 3 title/slug pairs ranked by fit. Title in Title Case, 1-4 words. Slug in kebab-case derived from title.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          slug: { type: "string" },
        },
      },
    },
  },
};

/**
 * Pre-allocation LLM call: takes the user's initial prompt and asks one
 * structured call for {skills, pairs}. The caller hands pairs to
 * ensureAppSlug as preferredPairs, and persists the chosen title + skills
 * into app_settings.
 *
 * Model: resolved via loadModels → `preSelected: ["app"]` entry in
 * models.json (currently openai/gpt-5.4-mini). No user/app overrides;
 * pre-alloc stays deterministic across users.
 */
export async function preAllocate(vctx: VibesApiSQLCtx, { prompt }: { prompt: string }): Promise<Result<PreAllocateResult>> {
  const rModels = await loadModels(vctx);
  if (rModels.isErr()) return Result.Err(rModels);
  const appDefault = rModels.Ok().models.find((m) => m.preSelected?.includes("app"));
  if (!appDefault) return Result.Err("no preSelected app model in catalog");

  const rCall = await exception2Result(() =>
    callAI(prompt, {
      model: appDefault.id,
      endpoint: vctx.params.llm.url,
      apiKey: vctx.params.llm.apiKey,
      schema: preAllocSchema,
    })
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
  return Result.Ok({
    skills: validated.skills,
    pairs: validated.pairs.slice(0, 3),
  });
}
