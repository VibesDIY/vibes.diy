import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import type { NewSessionChatState } from "@vibes.diy/prompts";

export function useNewSessionChat(
  onSessionCreate: (sessionId: string) => void,
): NewSessionChatState {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  const sendMessage = useCallback(
    async (textOverride?: string) => {
      const messageText = textOverride || input;

      if (!messageText.trim()) {
        return;
      }

      try {
        setIsStreaming(true);

        // Create new session ID
        const newSessionId = `session-${Date.now()}`;

        // Store the message text for later processing
        const userMessage = messageText.trim();

        // Navigate to the new session URL with prompt parameter - this will trigger a page load
        const targetUrl = `/chat/${newSessionId}?prompt=${encodeURIComponent(userMessage)}`;

        // Use window.location to trigger a real page load instead of React Router navigation
        window.location.href = targetUrl;
      } catch (error) {
        setIsStreaming(false);
      }
    },
    [input, onSessionCreate, navigate],
  );

  // Stub functions that are not needed for new session creation
  const saveCodeAsAiMessage = useCallback(async (): Promise<string> => {
    throw new Error("saveCodeAsAiMessage not available in new session");
  }, []);

  const updateTitle = useCallback(async (): Promise<void> => {
    // No-op for new session
  }, []);

  const addScreenshot = useCallback(async (): Promise<void> => {
    // No-op for new session
  }, []);

  const setSelectedResponseId = useCallback((): void => {
    // No-op for new session
  }, []);

  const addError = useCallback((): void => {
    // No-op for new session
  }, []);

  return {
    input,
    setInput,
    isStreaming,
    inputRef,
    sendMessage,
    docs: [], // Always empty for new sessions - triggers "I want to build..." placeholder
    isEmpty: true, // Always empty for new sessions
    codeReady: false, // No code ready in new session
    title: "", // No title for new session
    sessionId: null, // No session ID until created
    showModelPickerInChat: false, // Keep simple for now
    effectiveModel: "anthropic/claude-sonnet-4", // Default model
    globalModel: "anthropic/claude-sonnet-4",
    selectedModel: "anthropic/claude-sonnet-4",
    updateSelectedModel: undefined, // No model selection in new session for now
    saveCodeAsAiMessage,
    updateTitle,
    addScreenshot,
    setSelectedResponseId,
    selectedResponseDoc: undefined,
    selectedSegments: undefined,
    selectedCode: undefined,
    immediateErrors: [],
    advisoryErrors: [],
    addError,
    vibeDoc: undefined,
  };
}
