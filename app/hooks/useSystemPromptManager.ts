import { useCallback } from 'react';
import { APP_MODE } from '../config/env';
import { makeBaseSystemPrompt, resolveEffectiveModel } from '../prompts';
import type { UserSettings } from '../types/settings';
import type { VibeDocument } from '../types/chat';

// Default model is resolved via resolveEffectiveModel using settings + session

/**
 * Hook for managing system prompts based on settings
 * @param settingsDoc - User settings document that may contain model preferences
 * @param vibeDoc - Vibe document containing per-vibe settings
 * @param onAiDecisions - Callback to store AI-selected dependencies
 * @returns ensureSystemPrompt function that builds and returns a fresh system prompt
 */
export function useSystemPromptManager(
  settingsDoc: UserSettings | undefined,
  vibeDoc?: VibeDocument,
  onAiDecisions?: (decisions: { selected: string[] }) => void
) {
  // Stateless builder: always constructs and returns a fresh system prompt
  const ensureSystemPrompt = useCallback(
    async (overrides?: {
      userPrompt?: string;
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    }) => {
      if (APP_MODE === 'test') {
        return 'Test system prompt';
      }
      return makeBaseSystemPrompt(
        resolveEffectiveModel(settingsDoc, vibeDoc),
        {
          ...(settingsDoc || {}),
          ...(vibeDoc || {}),
          ...(overrides || {}),
        },
        onAiDecisions
      );
    },
    [settingsDoc, vibeDoc, onAiDecisions]
  );

  // Export only the builder function
  return ensureSystemPrompt;
}
