import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext.js";
import type {
  AiChatMessageDocument,
  ChatMessageDocument,
  ChatState,
} from "../types/chat.js";
import type { UserSettings } from "../types/settings.js";

import { useFireproof } from "use-fireproof";
import { SETTINGS_DBNAME } from "../config/env.js";
import { saveErrorAsSystemMessage } from "./saveErrorAsSystemMessage.js";
import { useApiKey } from "./useApiKey.js";
import { useImmediateErrorAutoSend } from "./useImmediateErrorAutoSend.js";
import {
  type ErrorCategory,
  type RuntimeError,
  useRuntimeErrors,
} from "./useRuntimeErrors.js";
import { useSession } from "./useSession.js";

import { useMessageSelection } from "./useMessageSelection.js";
// Import our custom hooks
import type { SendMessageContext } from "./sendMessage.js";
import { sendMessage as sendChatMessage } from "./sendMessage.js";
import { useSystemPromptManager } from "./useSystemPromptManager.js";
import { useThrottledUpdates } from "./useThrottledUpdates.js";

// Constants
const TITLE_MODEL = "meta-llama/llama-3.1-8b-instruct";

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
    [sessionDatabase, sessionId],
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
  const { doc: settingsDoc } = useDocument<UserSettings>({
    _id: "user_settings",
  });

  // State hooks
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [selectedResponseId, setSelectedResponseId] = useState<string>("");
  const [pendingAiMessage, setPendingAiMessage] =
    useState<ChatMessageDocument | null>(null);

  // Image attachment state
  const [attachedImages, setAttachedImages] = useState<
    Array<{ id: string; previewUrl: string; mimeType: string }>
  >([]);

  // setNeedsLogin is now obtained from AuthContext above

  // Derive model to use from settings or default
  const modelToUse = effectiveModel;

  // Create callback to store AI-selected dependencies
  const handleAiDecisions = useCallback(
    (decisions: { selected: string[] }) => {
      updateAiSelectedDependencies(decisions.selected);
    },
    [updateAiSelectedDependencies],
  );

  // Use our custom hooks
  const ensureSystemPrompt = useSystemPromptManager(
    settingsDoc,
    vibeDoc,
    handleAiDecisions,
  );

  const { throttledMergeAiMessage, isProcessingRef } =
    useThrottledUpdates(mergeAiMessage);

  // Keep track of the immediate user message for UI display
  const [pendingUserDoc, setPendingUserDoc] =
    useState<ChatMessageDocument | null>(null);

  // Prepare the full message list with any pending messages
  const allDocs = useMemo(() => {
    // Start with the existing messages from the database
    const result = [...docs];

    // If we have a pending user message that's not yet in the docs, add it
    if (pendingUserDoc && pendingUserDoc.text.trim()) {
      // Make sure it's not already in the list (to avoid duplicates)
      const exists = docs.some(
        (doc) =>
          doc.type === "user" &&
          (doc._id === pendingUserDoc._id || doc.text === pendingUserDoc.text),
      );

      if (!exists) {
        result.push(pendingUserDoc);
      }
    }

    return result;
  }, [docs, pendingUserDoc]);

  const {
    messages,
    selectedResponseDoc,
    selectedSegments,
    selectedCode,
    buildMessageHistory,
  } = useMessageSelection({
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
    [mergeUserMessage],
  );

  // No longer needed - proxy handles authentication
  const boundCheckCredits = useCallback(
    async (_key: string) => ({ available: 999999, usage: 0, limit: 999999 }),
    [],
  );

  /**
   * Send a message and process the AI response
   * @param textOverride Optional text to use instead of the current userMessage
   */
  // Image management functions
  const clearAttachedImages = useCallback(() => {
    // Revoke all preview URLs
    attachedImages.forEach((img) => {
      URL.revokeObjectURL(img.previewUrl);
    });

    // Clear state
    setAttachedImages([]);
  }, [attachedImages]);

  const sendMessage = useCallback(
    (textOverride?: string, skipSubmit = false) => {
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
        setPendingAiMessage,
        setSelectedResponseId,
        updateTitle,
        setInput,
        userId,
        titleModel: TITLE_MODEL,
        isAuthenticated,
        vibeDoc,
        attachedImages,
        clearAttachedImages,
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
      attachedImages,
      clearAttachedImages,
    ],
  );

  // Login handling no longer needed - proxy handles authentication

  // Determine if code is ready for display
  const codeReady = useMemo(() => {
    return (
      (!isStreaming && selectedSegments.length > 1) ||
      selectedSegments.length > 2
    );
  }, [isStreaming, selectedSegments]);

  // Effect to clear pending message once it appears in the main docs list
  useEffect(() => {
    if (
      pendingAiMessage &&
      docs.some((doc) => doc._id === pendingAiMessage._id)
    ) {
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
    async (
      code: string,
      currentMessages: ChatMessageDocument[],
    ): Promise<string> => {
      // Use the current UI messages state AS-IS - trust the array order
      // No sorting needed - the messages array is already in the correct order from the UI
      const messages = currentMessages;

      // SIMPLIFIED LOGIC: Just look at the last message in the array
      const lastMessage = messages[messages.length - 1];
      const isLastMessageFromUserEdit =
        lastMessage?.type === "ai" &&
        (lastMessage as AiChatMessageDocument)?.isEditedCode === true;

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
          type: "user" as const,
          session_id: session._id,
          text: "Edited by user",
          created_at: now,
        };
        await sessionDatabase.put(userMessageDoc);

        const aiMessageDoc = {
          type: "ai" as const,
          session_id: session._id,
          text: aiResponseText,
          created_at: now + 1,
          isEditedCode: true,
        };
        const result = await sessionDatabase.put(aiMessageDoc);
        return result.id || `ai-message-${Date.now()}`;
      }
    },
    [session._id, sessionDatabase],
  );

  // Monitor advisory errors whenever they change (non-critical errors)
  useEffect(() => {
    // Advisories are handled through the system messages mechanism
    // No additional action needed here
  }, [advisoryErrors]);

  // Image management functions
  const attachImages = useCallback(
    async (files: FileList) => {
      if (!sessionId) return;

      const newImages: Array<{
        id: string;
        previewUrl: string;
        mimeType: string;
      }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);

        // Create image document in Fireproof
        const imageDoc = {
          type: "image" as const,
          session_id: sessionId,
          created_at: Date.now(),
          _files: {
            image: file,
          },
        };

        try {
          const result = await sessionDatabase.put(imageDoc);
          newImages.push({
            id: result.id,
            previewUrl,
            mimeType: file.type,
          });
        } catch (error) {
          console.error("Failed to store image:", error);
          URL.revokeObjectURL(previewUrl);
        }
      }

      setAttachedImages((prev) => [...prev, ...newImages]);
    },
    [sessionId, sessionDatabase],
  );

  const removeAttachedImage = useCallback(
    async (id: string) => {
      // Find the image in our state
      const imageToRemove = attachedImages.find((img) => img.id === id);
      if (!imageToRemove) return;

      // Revoke the preview URL
      URL.revokeObjectURL(imageToRemove.previewUrl);

      // Remove from Fireproof
      try {
        await sessionDatabase.del(id);
      } catch (error) {
        console.error("Failed to delete image from database:", error);
      }

      // Remove from state
      setAttachedImages((prev) => prev.filter((img) => img.id !== id));
    },
    [attachedImages, sessionDatabase],
  );

  return {
    sessionId: session._id,
    vibeDoc,
    selectedModel: vibeDoc?.selectedModel,
    effectiveModel,
    globalModel: settingsDoc?.model,
    showModelPickerInChat: settingsDoc?.showModelPickerInChat || false,
    addScreenshot,
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
    title: vibeDoc?.title || "",
    updateTitle,
    // Error tracking
    immediateErrors,
    advisoryErrors,
    addError,
    isEmpty: docs.length === 0,
    updateSelectedModel,
    // Image management
    attachedImages,
    attachImages,
    removeAttachedImage,
    clearAttachedImages,
  };
}
