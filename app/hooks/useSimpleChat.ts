import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { AiChatMessageDocument, ChatMessageDocument, ChatState } from '../types/chat';
import type { UserSettings } from '../types/settings';

import { useFireproof } from 'use-fireproof';
import { SETTINGS_DBNAME } from '../config/env';
import { saveErrorAsSystemMessage } from './saveErrorAsSystemMessage';
import { useApiKey } from './useApiKey';
import { useImmediateErrorAutoSend } from './useImmediateErrorAutoSend';
import { type ErrorCategory, type RuntimeError, useRuntimeErrors } from './useRuntimeErrors';
import { useSession } from './useSession';

import { useMessageSelection } from './useMessageSelection';
// Import our custom hooks
import type { SendMessageContext } from './sendMessage';
import { sendMessage as sendChatMessage } from './sendMessage';
import { useSystemPromptManager } from './useSystemPromptManager';
import { useThrottledUpdates } from './useThrottledUpdates';

// Constants
const TITLE_MODEL = 'meta-llama/llama-3.1-8b-instruct';

/**
 * Simplified chat hook that focuses on data-driven state management
 * Uses session-based architecture with individual message documents
 * @returns ChatState object with all chat functionality and state
 */
export function useSimpleChat(sessionId: string | undefined): ChatState {
  // Get userId from auth system
  const { userPayload, isAuthenticated, setNeedsLogin } = useAuth();
  const userId = userPayload?.userId;

  // Get API key
  // For anonymous users: uses the sessionId (chat ID) as an identifier
  // For logged-in users: uses userId from auth
  // This approach ensures anonymous users get one API key with limited credits
  // and logged-in users will get proper credit assignment based on their ID
  // Using the useApiKey hook to get API key related functionality
  // Note: ensureApiKey is the key function we need for lazy loading
  const { ensureApiKey } = useApiKey();

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
    sessionDatabase,
    aiMessage,
    vibeDoc,
    updateAiSelectedDependencies,
    effectiveModel,
    updateSelectedModel,
  } = useSession(sessionId);

  // Get main database directly for settings document
  const { useDocument } = useFireproof(SETTINGS_DBNAME);

  // Function to save errors as system messages to the session database
  const saveErrorAsSystemMessageCb = useCallback(
    (error: RuntimeError, category: ErrorCategory) =>
      saveErrorAsSystemMessage(sessionDatabase, sessionId, error, category),
    [sessionDatabase, sessionId]
  );

  // State to track when errors were sent to the AI
  const [didSendErrors, setDidSendErrors] = useState(false);

  // Runtime error tracking with save callback and event-based clearing
  const { immediateErrors, advisoryErrors, addError } = useRuntimeErrors({
    onSaveError: saveErrorAsSystemMessageCb,
    didSendErrors,
  });

  // Reset didSendErrors after it's been processed
  useEffect(() => {
    if (didSendErrors) {
      // Small delay to ensure the errors are cleared before resetting
      const timer = setTimeout(() => {
        setDidSendErrors(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [didSendErrors]);

  // Reference for input element
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get settings document
  const { doc: settingsDoc } = useDocument<UserSettings>({ _id: 'user_settings' });

  // State hooks
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [selectedResponseId, setSelectedResponseId] = useState<string>('');
  const [pendingAiMessage, setPendingAiMessage] = useState<ChatMessageDocument | null>(null);

  // Image attachment state for the pending user message
  const [attachedImages, setAttachedImages] = useState<
    Array<{ id: string; previewUrl: string; mimeType: string }>
  >([]);

  const attachImages = useCallback(
    async (files: File[] | FileList): Promise<string[]> => {
      const list = Array.from(files || []).filter((f) => f && f.type.startsWith('image/'));
      if (!session?._id || list.length === 0) return [];
      const ids: string[] = [];
      for (const file of list) {
        const imageDoc = {
          type: 'image' as const,
          session_id: session._id,
          created_at: Date.now(),
          _files: { image: file as any },
        };
        const { id } = await sessionDatabase.put(imageDoc);
        ids.push(id);
        const url = URL.createObjectURL(file);
        setAttachedImages((prev) => [...prev, { id, previewUrl: url, mimeType: file.type }]);
      }
      return ids;
    },
    [session?._id, sessionDatabase]
  );

  const removeAttachedImage = useCallback(
    async (imageId: string) => {
      setAttachedImages((prev) => {
        const img = prev.find((i) => i.id === imageId);
        if (img?.previewUrl) {
          try {
            URL.revokeObjectURL(img.previewUrl);
          } catch {}
        }
        return prev.filter((img) => img.id !== imageId);
      });
      try {
        await (sessionDatabase as any).delete?.({ _id: imageId });
      } catch (_) {
        // ignore if not found
      }
    },
    [sessionDatabase]
  );

  const clearAttachedImages = useCallback(() => {
    // Do not delete here; these are referenced by the saved message now
    setAttachedImages((prev) => {
      for (const img of prev) {
        try {
          URL.revokeObjectURL(img.previewUrl);
        } catch {}
      }
      return [];
    });
  }, []);

  // setNeedsLogin is now obtained from AuthContext above

  // Derive model to use from settings or default
  const modelToUse = effectiveModel;

  // Create callback to store AI-selected dependencies
  const handleAiDecisions = useCallback(
    (decisions: { selected: string[] }) => {
      updateAiSelectedDependencies(decisions.selected);
    },
    [updateAiSelectedDependencies]
  );

  // Use our custom hooks
  const ensureSystemPrompt = useSystemPromptManager(settingsDoc, vibeDoc, handleAiDecisions);

  const { throttledMergeAiMessage, isProcessingRef } = useThrottledUpdates(mergeAiMessage);

  // Keep track of the immediate user message for UI display
  const [pendingUserDoc, setPendingUserDoc] = useState<ChatMessageDocument | null>(null);

  // Prepare the full message list with any pending messages
  const allDocs = useMemo(() => {
    // Start with the existing messages from the database
    const result = [...docs];

    // If we have a pending user message that's not yet in the docs, add it
    if (pendingUserDoc && pendingUserDoc.text.trim()) {
      // Make sure it's not already in the list (to avoid duplicates)
      const exists = docs.some(
        (doc) =>
          doc.type === 'user' &&
          (doc._id === pendingUserDoc._id || doc.text === pendingUserDoc.text)
      );

      if (!exists) {
        result.push(pendingUserDoc);
      }
    }

    return result;
  }, [docs, pendingUserDoc]);

  const { messages, selectedResponseDoc, selectedSegments, selectedCode, buildMessageHistory } =
    useMessageSelection({
      docs: allDocs,
      isStreaming,
      aiMessage,
      selectedResponseId,
      pendingAiMessage,
    });

  // Simple input handler
  const setInput = useCallback(
    (input: string) => {
      mergeUserMessage({ text: input });
    },
    [mergeUserMessage]
  );

  // No longer needed - proxy handles authentication
  const boundCheckCredits = useCallback(
    async (key: string) => ({ available: 999999, usage: 0, limit: 999999 }),
    []
  );

  /**
   * Send a message and process the AI response
   * @param textOverride Optional text to use instead of the current userMessage
   */
  const sendMessage = useCallback(
    (textOverride?: string, skipSubmit: boolean = false) => {
      const ctx: SendMessageContext = {
        userMessage,
        mergeUserMessage,
        setPendingUserDoc,
        setIsStreaming,
        ensureApiKey,
        setNeedsLogin,
        ensureSystemPrompt,
        submitUserMessage,
        buildMessageHistory,
        modelToUse,
        throttledMergeAiMessage,
        isProcessingRef,
        aiMessage,
        sessionDatabase,
        attachedImages,
        clearAttachedImages,
        setPendingAiMessage,
        setSelectedResponseId,
        updateTitle,
        setInput,
        userId,
        titleModel: TITLE_MODEL,
        isAuthenticated,
        vibeDoc,
      };
      return sendChatMessage(ctx, textOverride, skipSubmit);
    },
    [
      userMessage.text,
      ensureSystemPrompt,
      setIsStreaming,
      submitUserMessage,
      buildMessageHistory,
      modelToUse,
      throttledMergeAiMessage,
      isProcessingRef,
      aiMessage,
      sessionDatabase,
      setPendingAiMessage,
      setSelectedResponseId,
      updateTitle,
      boundCheckCredits,
      ensureApiKey,
      isAuthenticated,
    ]
  );

  // Login handling no longer needed - proxy handles authentication

  // Determine if code is ready for display
  const codeReady = useMemo(() => {
    return (!isStreaming && selectedSegments.length > 1) || selectedSegments.length > 2;
  }, [isStreaming, selectedSegments]);

  // Effect to clear pending message once it appears in the main docs list
  useEffect(() => {
    if (pendingAiMessage && docs.some((doc: any) => doc._id === pendingAiMessage._id)) {
      setPendingAiMessage(null);
    }
  }, [docs, pendingAiMessage]);

  // Credits are now checked directly during sendMessage after obtaining the API key
  // No need for a useEffect to check on apiKey changes

  // Auto-send for immediate runtime errors
  useImmediateErrorAutoSend({
    immediateErrors,
    isStreaming,
    userInput: userMessage.text,
    mergeUserMessage,
    setDidSendErrors,
    setIsStreaming,
  });

  // Function to save edited code as user edit + AI response
  const saveCodeAsAiMessage = useCallback(
    async (code: string, currentMessages: ChatMessageDocument[]): Promise<string> => {
      // Use the current UI messages state AS-IS - trust the array order
      // No sorting needed - the messages array is already in the correct order from the UI
      const messages = currentMessages;

      // SIMPLIFIED LOGIC: Just look at the last message in the array
      const lastMessage = messages[messages.length - 1];
      const isLastMessageFromUserEdit =
        lastMessage?.type === 'ai' && (lastMessage as AiChatMessageDocument)?.isEditedCode === true;

      // UPDATE if last message is AI with isEditedCode, otherwise CREATE
      const shouldUpdateExisting = isLastMessageFromUserEdit;

      const aiResponseText = `Code changes:

\`\`\`jsx
${code}
\`\`\``;

      if (shouldUpdateExisting) {
        const newTime = Date.now();
        const updateDoc = {
          ...(lastMessage as AiChatMessageDocument),
          text: aiResponseText,
          created_at: newTime,
          isEditedCode: true,
        };
        await sessionDatabase.put(updateDoc);
        return lastMessage._id || `updated-message-${Date.now()}`;
      } else {
        const now = Date.now();

        const userMessageDoc = {
          type: 'user' as const,
          session_id: session._id,
          text: 'Edited by user',
          created_at: now,
        };
        await sessionDatabase.put(userMessageDoc);

        const aiMessageDoc = {
          type: 'ai' as const,
          session_id: session._id,
          text: aiResponseText,
          created_at: now + 1,
          isEditedCode: true,
        };
        const result = await sessionDatabase.put(aiMessageDoc);
        return result.id || `ai-message-${Date.now()}`;
      }
    },
    [session._id, sessionDatabase]
  );

  // Monitor advisory errors whenever they change (non-critical errors)
  useEffect(() => {
    // Advisories are handled through the system messages mechanism
    // No additional action needed here
  }, [advisoryErrors]);

  return {
    sessionId: session._id,
    vibeDoc,
    selectedModel: vibeDoc?.selectedModel,
    effectiveModel,
    globalModel: settingsDoc?.model,
    showModelPickerInChat: settingsDoc?.showModelPickerInChat || false,
    addScreenshot,
    // Image attachments for pending message
    attachedImages,
    attachImages,
    removeAttachedImage,
    clearAttachedImages,
    docs: messages,
    setSelectedResponseId,
    selectedResponseDoc,
    selectedSegments,
    selectedCode,
    input: userMessage.text,
    setInput,
    isStreaming,
    codeReady,
    sendMessage,
    saveCodeAsAiMessage,
    inputRef,
    title: vibeDoc?.title || '',
    updateTitle,
    // Error tracking
    immediateErrors,
    advisoryErrors,
    addError,
    isEmpty: docs.length === 0,
    updateSelectedModel,
  };
}
