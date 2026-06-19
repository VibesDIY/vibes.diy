import type { Model } from "@vibes.diy/api-types";

// Whether a model accepts image (vision) input in its chat messages.
//
// Source of truth is the `imageInput` flag in the model catalog (models.json).
// The default is DENY: a model that is absent from the catalog or untagged
// returns false. This matters because the fallback dispatch path treats a
// provider 4xx as non-retryable — attaching an image to a text-only model
// (e.g. deepseek/*, qwen/*) would turn an ordinary follow-up into a hard
// failure rather than a plain text turn.
//
// The catalog is not yet exhaustively tagged (see VibesDIY/vibes.diy#1743
// follow-up); until it is, only the known vision families carry the flag.
export function modelSupportsImageInput(models: readonly Model[], modelId: string): boolean {
  return models.find((m) => m.id === modelId)?.imageInput === true;
}
