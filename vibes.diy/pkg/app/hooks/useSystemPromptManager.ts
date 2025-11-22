import { useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { VibesDiyEnv } from "../config/env.js";
import {
  makeBaseSystemPrompt,
  resolveEffectiveModel,
  UserSettings,
  VibeDocument,
  type SystemPromptResult,
} from "@vibes.diy/prompts";

// Default model is resolved via resolveEffectiveModel using settings + session

/**
 * Hook for managing system prompts based on settings
 * @param settingsDoc - User settings document that may contain model preferences
 * @param vibeDoc - Vibe document containing per-vibe settings
 * @returns ensureSystemPrompt function that builds and returns a fresh system prompt
 */
export function useSystemPromptManager(
  settingsDoc: UserSettings | undefined,
  vibeDoc?: VibeDocument,
) {
  const { getToken } = useAuth();

  // Stateless builder: always constructs and returns a fresh system prompt
  const ensureSystemPrompt = useCallback(
    async (overrides?: {
      userPrompt?: string;
      history?: {
        role: "user" | "assistant" | "system";
        content: string;
      }[];
    }): Promise<SystemPromptResult> => {
      if (VibesDiyEnv.APP_MODE() === "test") {
        return {
          systemPrompt: "Test system prompt",
          dependencies: ["useFireproof", "callAI"],
          instructionalText: true,
          demoData: false,
          model: "test-model",
        } satisfies SystemPromptResult;
      }
      const result = await makeBaseSystemPrompt(
        await resolveEffectiveModel(settingsDoc, vibeDoc),
        {
          fallBackUrl: VibesDiyEnv.PROMPT_FALL_BACKURL(),
          callAiEndpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
          userPrompt: overrides?.userPrompt || "",
          getAuthToken: async () => (await getToken()) || "",
          ...(settingsDoc || {}),
          ...(vibeDoc || {}),
          ...overrides,
        },
      );

      return result;
    },
    [settingsDoc, vibeDoc, getToken],
  );

  // Export only the builder function
  return ensureSystemPrompt;
}
