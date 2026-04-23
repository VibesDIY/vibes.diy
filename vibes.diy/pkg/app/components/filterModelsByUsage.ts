import type { Model } from "@vibes.diy/api-types";

export type ModelUsage = "chat" | "app" | "img";

const DEFAULT_SUPPORTS: readonly ModelUsage[] = ["chat", "app"];

export function filterModelsByUsage(models: Model[], usage: ModelUsage): Model[] {
  return models.filter((m) => {
    const supports = m.supports ?? DEFAULT_SUPPORTS;
    return supports.includes(usage);
  });
}
