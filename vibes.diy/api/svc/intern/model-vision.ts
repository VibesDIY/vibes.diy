// Whether a model accepts image (vision) input in its chat messages.
//
// models.json carries no input-modality metadata, so we keep a conservative
// allowlist of families we're confident accept image_url content parts. The
// default is DENY: unknown or text-only models return false. This matters
// because the fallback dispatch path treats a provider 4xx as non-retryable —
// attaching an image to a text-only model (e.g. deepseek/*, qwen/*) would turn
// an ordinary follow-up into a hard failure rather than a plain text turn.
export function modelSupportsImageInput(modelId: string): boolean {
  const id = modelId.toLowerCase();

  // Text-only variants that live inside otherwise-vision families — exclude
  // these first so the family prefixes below don't sweep them in.
  // gpt-oss-* are text-only; *-codex variants (gpt-5-codex, grok-code-fast-1,
  // gpt-5.3-codex) are code-focused and not reliably vision-capable.
  if (id.includes("gpt-oss")) return false;
  if (id.includes("codex")) return false;
  if (id.includes("grok-code")) return false;

  // Known vision-capable families.
  if (id.startsWith("anthropic/claude-")) return true;
  if (id.startsWith("google/gemini-")) return true;
  if (id.startsWith("google/gemma-3")) return true;
  if (id.startsWith("openai/gpt-4o")) return true;
  if (id.startsWith("openai/gpt-4.1")) return true;
  if (id.startsWith("openai/gpt-5")) return true;
  if (id.startsWith("x-ai/grok-4")) return true;

  return false;
}
