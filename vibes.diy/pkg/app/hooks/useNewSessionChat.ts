import {
  DEFAULT_CODING_MODEL,
  type NewSessionChatState,
  type UserSettings,
} from "@vibes.diy/prompts";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useFireproof } from "use-fireproof";
import { VibesDiyEnv } from "../config/env.js";
import { trackEvent } from "../utils/analytics.js";

export function useNewSessionChat(
  onSessionCreate: (sessionId: string) => void,
): NewSessionChatState {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | undefined>(
    undefined,
  );
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const navigate = useNavigate();

  // Get settings document to read showModelPickerInChat preference
  const { useDocument } = useFireproof(VibesDiyEnv.SETTINGS_DBNAME());
  const { doc: settingsDoc } = useDocument<UserSettings>({
    _id: "user_settings",
  });

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
        if (selectedModel) {
          urlParams.set("model", selectedModel);
        }

        const targetUrl = `/chat/${newSessionId}?${urlParams.toString()}`;

        // Track session creation before navigation
        trackEvent("new_session_created", {
          model: selectedModel || effectiveModel,
        });

        // Use window.location to trigger a real page load instead of React Router navigation
        window.location.href = targetUrl;
      } catch (error) {
        setIsStreaming(false);
      }
    },
    [input, selectedModel, effectiveModel, onSessionCreate, navigate],
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
      setSelectedModel(modelId);
    },
    [],
  );

  // Determine effective model: user selection > global setting > default
  const effectiveModel =
    selectedModel || settingsDoc?.model || DEFAULT_CODING_MODEL;

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
    showModelPickerInChat: settingsDoc?.showModelPickerInChat || false,
    effectiveModel,
    globalModel: settingsDoc?.model || DEFAULT_CODING_MODEL,
    selectedModel,
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
