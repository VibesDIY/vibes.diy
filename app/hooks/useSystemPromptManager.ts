import { useCallback, useEffect, useState } from 'react';
import { APP_MODE } from '../config/env';
import { makeBaseSystemPrompt } from '../prompts';
import type { UserSettings } from '../types/settings';

// Model constant used for system prompts
const CODING_MODEL = 'anthropic/claude-sonnet-4';

/**
 * Hook for managing system prompts based on settings
 * @param settingsDoc - User settings document that may contain model preferences
 * @returns Object with systemPrompt state and utility functions
 */
export function useSystemPromptManager(settingsDoc: UserSettings | undefined) {
  const [systemPrompt, setSystemPrompt] = useState('');

  // Reset system prompt when settings change
  useEffect(() => {
    if (settingsDoc && systemPrompt) {
      // Only reset if we already have a system prompt (don't trigger on initial load)
      const loadNewPrompt = async () => {
        const newPrompt = await makeBaseSystemPrompt(CODING_MODEL, settingsDoc);
        setSystemPrompt(newPrompt);
      };
      loadNewPrompt();
    }
  }, [settingsDoc, systemPrompt]);

  // Function to ensure we have a system prompt
  const ensureSystemPrompt = useCallback(
    async (overrides?: {
      userPrompt?: string;
      history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    }) => {
      if (systemPrompt) return systemPrompt;

      let newPrompt = '';
      if (APP_MODE === 'test') {
        newPrompt = 'Test system prompt';
      } else {
        newPrompt = await makeBaseSystemPrompt(CODING_MODEL, {
          ...(settingsDoc || {}),
          ...(overrides || {}),
        });
      }

      setSystemPrompt(newPrompt);
      return newPrompt;
    },
    [systemPrompt, settingsDoc]
  );

  return { systemPrompt, setSystemPrompt, ensureSystemPrompt };
}
