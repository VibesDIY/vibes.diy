import { type NewSessionChatState } from "@vibes.diy/prompts";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trackEvent } from "../utils/analytics.js";
import { useModelSelection } from "./useModelSelection.js";

export function useNewSessionChat(
  onSessionCreate: (sessionId: string) => void,
): NewSessionChatState {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  const modelSelection = useModelSelection();

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

        // Build URL with prompt and optional model parameter
        const urlParams = new URLSearchParams();
        urlParams.set("prompt", userMessage);

        // If user selected a specific model, pass it to the new session
        if (modelSelection.selectedModel) {
          urlParams.set("model", modelSelection.selectedModel);
        }

        const targetUrl = `/chat/${newSessionId}?${urlParams.toString()}`;

        // Track session creation before navigation
        trackEvent("new_session_created", {
          model: modelSelection.effectiveModel,
        });

        // Delay navigation slightly to allow analytics event to flush
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 20);
      } catch (error) {
        setIsStreaming(false);
      }
    },
    [
      input,
      modelSelection.selectedModel,
      modelSelection.effectiveModel,
      onSessionCreate,
      navigate,
    ],
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

  const updateSelectedModel = useCallback(
    async (modelId: string): Promise<void> => {
      modelSelection.setSelectedModel(modelId);
    },
    [modelSelection],
  );

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
    showModelPickerInChat: modelSelection.showModelPickerInChat,
    effectiveModel: modelSelection.effectiveModel,
    globalModel: modelSelection.globalModel,
    selectedModel: modelSelection.selectedModel,
    updateSelectedModel,
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
