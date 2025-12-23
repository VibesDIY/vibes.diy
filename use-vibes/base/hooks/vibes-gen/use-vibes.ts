import { makeBaseSystemPrompt, parseContent } from '@vibes.diy/prompts';
import type { UseVibesOptions, UseVibesResult, UseVibesState } from '@vibes.diy/use-vibes-types';
import { callAI as defaultCallAI } from 'call-ai';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IframeVibesComponent } from './IframeVibesComponent.js';

/**
 * useVibes hook - Cycle 1 implementation
 * Generates React components from text prompts using AI
 */
export function useVibes(
  prompt: string,
  options: UseVibesOptions = {},
  callAI: typeof defaultCallAI = defaultCallAI
): UseVibesResult {
  // Always call hooks first before any early returns
  const [state, setState] = useState<UseVibesState>({
    App: null,
    code: null,
    loading: false, // Start as false, will be set to true when generation starts
    error: null,
    progress: 0,
    document: null,
  });

  // Track generation requests to handle concurrent calls
  const generationIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [regenerationTrigger, setRegenerationTrigger] = useState<number>(0);

  // Progress simulation for Cycle 1
  const simulateProgress = useCallback((currentProgress = 0) => {
    const increment = Math.random() * 20 + 10; // 10-30% increments
    const newProgress = Math.min(currentProgress + increment, 90);

    if (mountedRef.current) {
      setState((prev) => ({ ...prev, progress: newProgress }));

      if (newProgress < 90) {
        progressTimerRef.current = setTimeout(
          () => simulateProgress(newProgress),
          100 + Math.random() * 200
        );
      }
    }
  }, []);

  // Regenerate function
  const regenerate = useCallback(() => {
    // Trigger regeneration by updating generation ID and state
    generationIdRef.current = `regen-${Date.now()}`;
    setRegenerationTrigger((prev) => prev + 1);
  }, []);

  // Effect to start generation - only when prompt or options change
  useEffect(() => {
    if (!mountedRef.current) return;

    // Validate inputs - set error state instead of early return
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: new Error('Prompt required'),
        App: null,
        code: null,
        progress: 0,
      }));
      return;
    }

    // Skip processing if explicitly requested
    if (options.skip) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        App: null,
        code: null,
        progress: 0,
      }));
      return;
    }

    const generationId = Date.now().toString();
    generationIdRef.current = generationId;

    const generateComponent = async () => {
      try {
        // Clear any existing progress timer
        if (progressTimerRef.current) {
          clearTimeout(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        // Reset state for new generation
        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          progress: 0,
          App: null,
          code: null,
        }));

        // Start progress simulation
        simulateProgress(0);

        // Use the full orchestrator for two-stage generation
        let result;
        try {
          result = await makeBaseSystemPrompt(options.model || 'anthropic/claude-sonnet-4.5', {
            userPrompt: prompt,
            history: [],
            fallBackUrl: 'https://esm.sh/@vibes.diy/prompts/llms',
            // Pass through any user overrides
            dependencies: options.dependencies,
            dependenciesUserOverride: !!options.dependencies,
          });
        } catch (error) {
          // Fallback to a simple but functional system prompt
          result = {
            systemPrompt: `You are a React component generator. Generate a complete React component based on the user's prompt. 
Use Fireproof for data persistence. Begin the component with the import statements.
Return only the JSX code with a default export. Use modern React patterns with hooks if needed.`,
            dependencies: options.dependencies || ['useFireproof'],
            demoData: false,
            model: options.model || 'anthropic/claude-sonnet-4.5',
          };
        }

        const systemPrompt = result.systemPrompt;
        const metadata = {
          dependencies: result.dependencies,
          aiSelectedDependencies: result.dependencies,
          demoData: result.demoData,
          model: result.model,
          timestamp: Date.now(),
        };

        // Generate the actual component using the system prompt
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: prompt },
        ];

        const aiResponse = await callAI(messages, {
          model: metadata.model,
          max_tokens: 2000,
        });

        // Check if this request is still current (handle race conditions)
        if (generationIdRef.current !== generationId || !mountedRef.current) {
          return;
        }

        const rawResponse = typeof aiResponse === 'string' ? aiResponse : '';

        // Parse the AI response to extract code segments
        const { segments } = parseContent(rawResponse);

        // Find the first code block
        const codeSegment = segments.find((segment) => segment.type === 'code');
        const extractedCode = codeSegment ? codeSegment.content : '';

        // Use extracted code for compilation, fallback to raw response if no code found
        const codeToUse = extractedCode || rawResponse;

        // Create iframe component with extracted code
        const sessionId = `vibes-${Date.now()}`;
        const App = () =>
          React.createElement(IframeVibesComponent, {
            code: codeToUse,
            sessionId: sessionId,
            authToken: options.authToken,
            onReady: () => {
              // Component is ready
            },
            onError: (_error) => {
              // Component error occurred
            },
          });

        // Update state with results, including rich metadata from orchestrator
        setState((prev) => ({
          ...prev,
          App,
          code: codeToUse,
          loading: false,
          progress: 100,
          document: {
            _id: `vibe-${Date.now()}`,
            prompt,
            code: codeToUse,
            title: 'Generated Component',
            // Include all metadata from the orchestrator
            ...metadata,
            created_at: Date.now(),
            version: 1,
          },
        }));
      } catch (error) {
        // Check if this request is still current
        if (generationIdRef.current !== generationId || !mountedRef.current) {
          return;
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error('Generation failed'),
          progress: 0,
        }));
      }
    };

    generateComponent();

    // Cleanup function
    return () => {
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [prompt, JSON.stringify(options), callAI, simulateProgress, regenerationTrigger]); // Include regeneration trigger

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, []);

  return {
    App: state.App,
    code: state.code,
    loading: state.loading,
    error: state.error,
    progress: state.progress,
    regenerate,
    document: state.document,
  };
}
