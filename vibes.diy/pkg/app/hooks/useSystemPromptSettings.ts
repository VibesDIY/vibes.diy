import { useMemo } from "react";
import { UserSettings, VibeDocument } from "@vibes.diy/prompts";
import { ChatSettings } from "@vibes.diy/api-types";

/**
 * Hook for collecting settings to send to server for prompt building
 * The server handles system prompt generation
 * @param settingsDoc - User settings document that may contain model preferences
 * @param vibeDoc - Vibe document containing per-vibe settings
 * @returns ChatSettings object to send to the server
 */
export function useSystemPromptSettings(
  settingsDoc: UserSettings | undefined,
  vibeDoc?: VibeDocument
): ChatSettings {
  return useMemo(
    () => ({
      globalModel: settingsDoc?.model,
      selectedModel: vibeDoc?.selectedModel,
      stylePrompt: settingsDoc?.stylePrompt,
      dependencies: vibeDoc?.dependencies || settingsDoc?.dependencies,
      dependenciesUserOverride: vibeDoc?.dependenciesUserOverride || settingsDoc?.dependenciesUserOverride,
      demoDataOverride: vibeDoc?.demoDataOverride || settingsDoc?.demoDataOverride,
      useRagSelection: false, // Default to using defaults, not RAG
    }),
    [settingsDoc, vibeDoc]
  );
}
