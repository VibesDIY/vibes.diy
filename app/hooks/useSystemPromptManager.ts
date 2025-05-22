import { useState, useCallback, useEffect } from 'react';
import type { UserSettings } from '../types/settings';
import { makeBaseSystemPrompt } from '../prompts';

// Model constant used for system prompts
const CODING_MODEL = 'anthropic/claude-opus-4';

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
  const ensureSystemPrompt = useCallback(async () => {
    if (systemPrompt) return systemPrompt;

    let newPrompt = '';
    if (import.meta.env.MODE === 'test') {
      newPrompt = 'Test system prompt';
    } else {
      newPrompt = await makeBaseSystemPrompt(CODING_MODEL, settingsDoc);
    }

    setSystemPrompt(newPrompt);
    return newPrompt;
  }, [systemPrompt, settingsDoc]);

  return { systemPrompt, setSystemPrompt, ensureSystemPrompt };
}
