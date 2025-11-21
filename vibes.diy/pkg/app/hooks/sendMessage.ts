import { Database } from "use-fireproof";
import {
  resolveEffectiveModel,
  type AiChatMessageDocument,
  type ChatMessageDocument,
  type VibeDocument,
  type SystemPromptResult,
} from "@vibes.diy/prompts";
import { trackChatInputClick, trackEvent } from "../utils/analytics.js";
import { parseContent } from "@vibes.diy/prompts";
import { streamAI } from "../utils/streamHandler.js";
import { generateTitle } from "../utils/titleGenerator.js";
import { AUTH_REQUIRED_ERROR } from "../utils/authErrors.js";

export interface SendMessageContext {
  userMessage: ChatMessageDocument;
  setPendingUserDoc: (doc: ChatMessageDocument) => void;
  setIsStreaming: (v: boolean) => void;
  ensureApiKey: () => Promise<{ key: string } | null>;
  setNeedsLogin: (v: boolean) => void;
  ensureSystemPrompt: (overrides?: {
    userPrompt?: string;
    history?: { role: "user" | "assistant" | "system"; content: string }[];
  }) => Promise<SystemPromptResult>;
  submitUserMessage: () => Promise<void>;
  buildMessageHistory: () => {
    role: "user" | "assistant" | "system";
    content: string;
  }[];
  modelToUse: string[];
  throttledMergeAiMessage: (content: string) => void;
  isProcessingRef: { current: boolean };
  aiMessage: AiChatMessageDocument;
  sessionDatabase: Database;
  setPendingAiMessage: (doc: ChatMessageDocument | null) => void;
  setSelectedResponseId: (id: string) => void;
  updateTitle: (title: string, isManual?: boolean) => Promise<void>;
  setInput: (text: string) => void;
  titleModel: string;
  isAuthenticated: boolean;
  vibeDoc: VibeDocument;
}

export async function sendChatMessage(
  ctx: SendMessageContext,
  textOverride?: string,
): Promise<void> {
  const {
    userMessage,
    setPendingUserDoc,
    setIsStreaming,
    ensureApiKey,
    setNeedsLogin,
    ensureSystemPrompt,
    submitUserMessage,
    buildMessageHistory,
    throttledMergeAiMessage,
    isProcessingRef,
    aiMessage,
    sessionDatabase,
    setPendingAiMessage,
    setSelectedResponseId,
    updateTitle,
    setInput,
    titleModel,
    isAuthenticated,
    vibeDoc,
  } = ctx;

  const promptText =
    typeof textOverride === "string" ? textOverride : userMessage.text;
  trackChatInputClick(promptText.length);

  if (!promptText.trim()) return;

  // Allow user message to be submitted, but check authentication for AI processing
  if (!isAuthenticated) {
    setNeedsLogin(true);
  }

  setPendingUserDoc({
    ...userMessage,
    text: promptText,
  });

  await submitUserMessage();
  // Clear the chat input once the user message has been submitted
  setInput("");

  setIsStreaming(true);

  // Get API key - will return dummy key for proxy-managed auth
  let currentApiKey = "";
  try {
    const keyObject = await ensureApiKey();
    // Always use the key from ensureApiKey (will be dummy key 'sk-vibes-proxy-managed')
    currentApiKey = keyObject?.key || "";
  } catch (err) {
    console.warn("Error getting API key:", err);
    // This should not happen with the new useApiKey implementation
    currentApiKey = "sk-vibes-proxy-managed";
  }

  // Credit checking no longer needed - proxy handles it

  // Build the history that will be used for the code-writing prompt
  const messageHistory = buildMessageHistory();

  // Compose system prompt with schema-based module selection using prompt + history
  const promptResult = await ensureSystemPrompt({
    userPrompt: promptText,
    history: messageHistory,
  });
  const currentSystemPrompt = promptResult.systemPrompt;

  const modelToUse = await resolveEffectiveModel(
    { model: ctx.modelToUse?.[0] },
    vibeDoc,
  );

  return streamAI(
    modelToUse,
    currentSystemPrompt,
    messageHistory,
    promptText,
    (content) => throttledMergeAiMessage(content),
    currentApiKey,
    undefined, // userId
    setNeedsLogin,
  )
    .then(async (finalContent) => {
      isProcessingRef.current = true;

      try {
        if (typeof finalContent === "string" && finalContent.startsWith("{")) {
          try {
            const parsedContent = JSON.parse(finalContent);

            if (parsedContent.error) {
              setInput(promptText);
              finalContent = `Error: ${JSON.stringify(parsedContent.error)}`;
            } else {
              finalContent = parsedContent;
            }
          } catch (jsonError) {
            console.warn(
              "Error parsing JSON response:",
              jsonError,
              finalContent,
            );
          }
        }

        if (!finalContent) {
          console.warn("No response from AI");
          finalContent = "Error: No response from AI service.";
        } else if (
          typeof finalContent === "string" &&
          finalContent.trim().length === 0
        ) {
          console.warn(
            "Empty response from AI, this might indicate an API issue",
          );
          // Save an error message instead of returning early
          finalContent =
            "Error: Empty response from AI service. This might be due to missing API key or proxy issues.";
        }

        if (aiMessage?.text !== finalContent) {
          aiMessage.text = finalContent;
        }

        aiMessage.model = modelToUse;
        const { id } = (await sessionDatabase.put(aiMessage)) as { id: string };
        setPendingAiMessage({ ...aiMessage, _id: id });
        setSelectedResponseId(id);

        // Emit app_created once per session (guard on first AI message id)
        try {
          if (aiMessage?.session_id) {
            const key = `app_created_${aiMessage.session_id}`;
            const already = sessionStorage.getItem(key);
            if (!already) {
              trackEvent("app_created", {
                session_id: aiMessage.session_id,
                model: modelToUse,
                title: vibeDoc?.title || undefined,
              });
              sessionStorage.setItem(key, "1");
            }
          }
        } catch {
          // ignore storage errors
        }

        // Skip title generation if the response is an error or title was set manually
        const isErrorResponse =
          typeof finalContent === "string" && finalContent.startsWith("Error:");
        const titleSetManually = vibeDoc?.titleSetManually === true;

        if (!isErrorResponse && !titleSetManually) {
          const { segments } = parseContent(aiMessage?.text || "");
          try {
            const title = await generateTitle(
              segments,
              titleModel,
              currentApiKey,
            );
            if (title) {
              await updateTitle(title, false); // Mark as AI-generated
            }
          } catch (titleError) {
            console.warn("Failed to generate title:", titleError);
          }
        }
      } finally {
        isProcessingRef.current = false;
      }
    })
    .catch((error) => {
      console.warn("Error in sendMessage:", error);

      // If authentication error, trigger login flow
      if (error.message === AUTH_REQUIRED_ERROR) {
        // Force login modal to show (this will work even if local state thinks we're authenticated)
        setNeedsLogin(true);

        // Clean up state
        isProcessingRef.current = false;
        setPendingAiMessage(null);
        setSelectedResponseId("");

        // Restore the user's input so they can retry after login
        setInput(promptText);
        return; // Exit early without saving error to chat
      }

      // For other errors, clean up as usual
      isProcessingRef.current = false;
      setPendingAiMessage(null);
      setSelectedResponseId("");
    })
    .finally(() => {
      setIsStreaming(false);
      // Credit checking no longer needed
    });
}
