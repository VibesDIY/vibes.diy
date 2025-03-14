import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Segment, ChatMessageDocument, ChatState } from '../types/chat';
import { makeBaseSystemPrompt } from '../prompts';
import { parseContent, parseDependencies } from '../utils/segmentParser';
import { useSession } from './useSession';
import { generateTitle } from '../utils/titleGenerator';
import { processStream, callOpenRouterAPI } from '../utils/streamHandler';

const CODING_MODEL = 'anthropic/claude-3.7-sonnet';
const TITLE_MODEL = 'google/gemini-2.0-flash-lite-001';
/**
 * Simplified chat hook that focuses on data-driven state management
 * Uses session-based architecture with individual message documents
 * @returns ChatState object with all chat functionality and state
 */
export function useSimpleChat(sessionId: string | undefined): ChatState {
  // Get session data
  const {
    session,
    updateTitle,
    docs,
    userMessage,
    mergeUserMessage,
    submitUserMessage,
    mergeAiMessage,
    addScreenshot,
    // screenshots,
    database,
    aiMessage,
  } = useSession(sessionId);

  // First declare ALL ref hooks to maintain hook order consistency
  const streamBufferRef = useRef<string>('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastUpdateTimeRef = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Then declare state hooks
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [selectedResponseId, setSelectedResponseId] = useState<string>(''); // default most recent

  const selectedResponseDoc = (isStreaming
    ? aiMessage
    : docs.find((doc: any) => doc.type === 'ai' && doc._id === selectedResponseId) ||
      docs.filter((doc: any) => doc.type === 'ai').reverse()[0]) as unknown as ChatMessageDocument;

  const setInput = useCallback(
    (input: string) => {
      mergeUserMessage({ text: input });
    },
    [mergeUserMessage]
  );

  // Process docs into messages for the UI
  const filteredDocs = docs.filter((doc: any) => doc.type === 'ai' || doc.type === 'user');

  const messages = (isStreaming && aiMessage.text.length > 0
    ? [...filteredDocs, aiMessage]
    : filteredDocs) as unknown as ChatMessageDocument[];

  const buildMessageHistory = useCallback(() => {
    return messages.map((msg) => ({
      role: msg.type === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.text || '',
    }));
  }, [messages]);

  const { segments: selectedSegments, dependenciesString: selectedDependenciesString } =
    selectedResponseDoc
      ? parseContent(selectedResponseDoc.text)
      : { segments: [], dependenciesString: '' };

  const selectedCode =
    selectedSegments.find((segment) => segment.type === 'code') || ({ content: '' } as Segment);

  const selectedDependencies = selectedDependenciesString
    ? parseDependencies(selectedDependenciesString)
    : {};

  // Throttled update function with fixed 10ms delay
  const throttledMergeAiMessage = useCallback(
    (content: string) => {
      // Store content in ref
      streamBufferRef.current = content;

      // If we're already processing a database operation, don't trigger more updates
      if (isProcessingRef.current) {
        return;
      }

      // Clear any pending timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }

      // Use a fixed 10ms throttle delay
      const THROTTLE_DELAY = 10;

      // Schedule update with fixed delay
      updateTimeoutRef.current = setTimeout(() => {
        lastUpdateTimeRef.current = Date.now();
        mergeAiMessage({ text: streamBufferRef.current });
      }, THROTTLE_DELAY);
    },
    [mergeAiMessage]
  );

  /**
   * Send a message and process the AI response
   * Returns a promise that resolves when the entire process is complete, including title generation
   */
  const sendMessage = useCallback(async (): Promise<void> => {
    if (!userMessage.text.trim()) return;

    // First, ensure we have the system prompt
    // Instead of setting state and immediately using it, get the value and use it directly
    let currentSystemPrompt = systemPrompt;
    if (!currentSystemPrompt) {
      if (import.meta.env.MODE === 'test') {
        currentSystemPrompt = 'Test system prompt';
        setSystemPrompt(currentSystemPrompt);
      } else {
        currentSystemPrompt = await makeBaseSystemPrompt(CODING_MODEL);
        setSystemPrompt(currentSystemPrompt);
      }
    }

    // Reset stream buffer and set streaming state
    streamBufferRef.current = '';
    setIsStreaming(true);

    // Submit user message first
    return submitUserMessage()
      .then(() => {
        const messageHistory = buildMessageHistory();
        // Use the locally captured system prompt value, not the state variable
        return callOpenRouterAPI(
          CODING_MODEL,
          currentSystemPrompt,
          messageHistory,
          userMessage.text
        );
      })
      .then((response) => {
        return processStream(response, (content) => {
          // Append to buffer and use throttled update
          streamBufferRef.current += content;
          throttledMergeAiMessage(streamBufferRef.current);
        });
      })
      .then(async () => {
        // Set processing flag to prevent infinite updates
        isProcessingRef.current = true;

        try {
          // Only do a final update if the current state doesn't match our buffer
          if (aiMessage.text !== streamBufferRef.current) {
            // First update the aiMessage object (no state update)
            aiMessage.text = streamBufferRef.current;
          }

          // Then persist to database
          await database.put(aiMessage);

          // Finally, generate title if needed
          const { segments } = parseContent(aiMessage.text);
          if (!session?.title) {
            await generateTitle(segments, TITLE_MODEL).then(updateTitle);
          }
        } finally {
          // Always clear the processing flag
          isProcessingRef.current = false;
        }
      })
      .catch((error) => {
        console.error('Error processing stream:', error);
        isProcessingRef.current = false;
      })
      .finally(() => {
        setIsStreaming(false);
      });
  }, [
    userMessage.text,
    systemPrompt,
    setSystemPrompt,
    streamBufferRef,
    setIsStreaming,
    submitUserMessage,
    buildMessageHistory,
    throttledMergeAiMessage,
    aiMessage,
    database,
    session?.title,
    updateTitle,
  ]);

  // TODO: make a version of this that only saves the first
  // for the given message source. so one each message.
  // const addFirstScreenshot = useCallback(
  //   async (screenshotData: string) => {
  //     const { rows: screenshots } = await database.query((doc: any) => [doc.session_id, doc.type], {
  //       key: [session._id, 'screenshot'],
  //     });
  //     if (screenshots.length === 0) {
  //       addScreenshot(screenshotData);
  //     }
  //   },
  //   [session._id, database, addScreenshot]
  // );

  const codeReady = useMemo(() => {
    return !isStreaming || selectedSegments.length > 2;
  }, [isStreaming, selectedSegments]);

  // Cleanup any pending updates when the component unmounts
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    sessionId: session._id,
    addScreenshot,
    docs: messages,
    setSelectedResponseId,
    selectedResponseDoc,
    selectedSegments,
    selectedCode,
    selectedDependencies,
    input: userMessage.text,
    setInput,
    isStreaming,
    codeReady,
    sendMessage,
    inputRef,
    title: session?.title || '',
  };
}
