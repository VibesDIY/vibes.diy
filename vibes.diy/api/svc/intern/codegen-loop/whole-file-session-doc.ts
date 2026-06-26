import type { ActiveSettings } from "../prompt-assembly.js";
import type { WholeFileCodegenSessionDoc } from "../../public/handle-whole-file-codegen.js";

/**
 * Map the persisted active settings (theme/skills/title/enrichedPrompt — the
 * `active.*` app_settings rows `ensureChatId` wrote from its one pre-allocation
 * call) into the whole-file handler's sessionDoc so the agentic system prompt's
 * {{THEME_DESIGN}} / skills / enriched-prompt slots are filled. With no
 * persisted settings (pre-alloc failed or was ineligible upstream — the reader
 * returns `{}` or the caller passes `undefined`), this returns `{ userPrompt }`
 * only, so generation proceeds on the default theme rather than blocking. Each
 * field is added only when present, so an empty settings object collapses to the
 * same userPrompt-only doc. Sourcing from the persisted settings (not a second
 * LLM call) guarantees the prompt theme is identical to the app_settings theme a
 * later cold-open reads.
 */
export function buildWholeFileSessionDoc(userPrompt: string, settings?: ActiveSettings): WholeFileCodegenSessionDoc {
  const doc: WholeFileCodegenSessionDoc = { userPrompt };
  if (settings === undefined) return doc;
  if (settings.theme !== undefined) doc.theme = settings.theme;
  if (settings.skills !== undefined) doc.skills = settings.skills;
  if (settings.title !== undefined) doc.title = settings.title;
  if (settings.enrichedPrompt !== undefined) doc.enrichedPrompt = settings.enrichedPrompt;
  return doc;
}
