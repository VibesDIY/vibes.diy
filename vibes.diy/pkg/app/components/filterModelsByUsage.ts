import type { Model } from "@vibes.diy/api-types";

// Canonical model-usage names (#2608): codegen (building vibes) / runtime
// (a deployed vibe's own AI calls) / img.
export type ModelUsage = "codegen" | "runtime" | "img";

const DEFAULT_SUPPORTS: readonly ModelUsage[] = ["codegen", "runtime"];

export function filterModelsByUsage(models: Model[], usage: ModelUsage): Model[] {
  return models.filter((m) => {
    const supports = m.supports ?? DEFAULT_SUPPORTS;
    return supports.includes(usage);
  });
}
