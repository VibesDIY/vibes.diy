import { getThemeBySlug } from "@vibes.diy/prompts";
import type { PromptSectionTheme } from "@vibes.diy/api-types";
import type { PromptAction } from "../routes/chat/prompt-state.js";

export function isSectionTheme(block: unknown): block is PromptSectionTheme {
  return typeof block === "object" && block !== null && (block as { type?: unknown }).type === "prompt.section-theme";
}

export function sectionThemeActions(block: PromptSectionTheme): PromptAction[] {
  const actions: PromptAction[] = [];
  const theme = getThemeBySlug(block.theme);
  if (theme !== undefined) actions.push({ type: "setTheme", theme });
  if (typeof block.colorTheme === "string" && block.colorTheme.length > 0) {
    actions.push({ type: "setColorTheme", colorTheme: block.colorTheme });
  }
  return actions;
}
