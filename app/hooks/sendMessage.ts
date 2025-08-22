import type {
  AiChatMessageDocument,
  ChatMessageDocument,
  UserChatMessageDocument,
} from '../types/chat';
import { trackChatInputClick } from '../utils/analytics';
import { parseContent } from '../utils/segmentParser';
import { streamAI } from '../utils/streamHandler';
import { generateTitle } from '../utils/titleGenerator';

export interface SendMessageContext {
  userMessage: ChatMessageDocument;
  mergeUserMessage: (msg: Partial<UserChatMessageDocument>) => void;
  setPendingUserDoc: (doc: ChatMessageDocument) => void;
  setIsStreaming: (v: boolean) => void;
  ensureApiKey: () => Promise<{ key: string } | null>;
  setNeedsLogin: (v: boolean, reason: string) => void;
  ensureSystemPrompt: (overrides?: {
    userPrompt?: string;
    history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  }) => Promise<string>;
  submitUserMessage: () => Promise<any>;
  buildMessageHistory: () => any[];
  modelToUse: string;
  throttledMergeAiMessage: (content: string) => void;
  isProcessingRef: { current: boolean };
  aiMessage: AiChatMessageDocument;
  sessionDatabase: any;
  attachedImages:
    | Array<{ id: string }>
    | Array<{ id: string; previewUrl?: string; mimeType?: string }>;
  clearAttachedImages: () => void;
  setPendingAiMessage: (doc: ChatMessageDocument | null) => void;
  setSelectedResponseId: (id: string) => void;
  updateTitle: (title: string, isManual?: boolean) => Promise<void>;
  setInput: (text: string) => void;
  userId: string | undefined;
  titleModel: string;
  isAuthenticated: boolean;
  vibeDoc: any;
}

export async function sendMessage(
  ctx: SendMessageContext,
  textOverride?: string,
  skipSubmit: boolean = false
): Promise<void> {
  const {
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
    titleModel,
    isAuthenticated,
    vibeDoc,
  } = ctx;

  const promptText = typeof textOverride === 'string' ? textOverride : userMessage.text;
  trackChatInputClick(promptText.length);

  if (!promptText.trim()) return;

  // Allow user message to be submitted, but check authentication for AI processing
  if (!isAuthenticated) {
    setNeedsLogin(true, 'sendMessage not authenticated');
  }

  if (typeof textOverride === 'string' && !skipSubmit) {
    // Update the transient userMessage state so UI reflects any override text
    // Only update when we are not in retry mode (skipSubmit === false)
    mergeUserMessage({ text: textOverride });
  }

  // Merge any pending image IDs into the user message before submit
  if (!skipSubmit && Array.isArray(ctx.attachedImages) && ctx.attachedImages.length > 0) {
    const imageIds = ctx.attachedImages.map((i) => i.id);
    mergeUserMessage({ images: imageIds });
  }

  setPendingUserDoc({
    ...userMessage,
    text: promptText,
  });

  // Capture the image IDs now (will be cleared from UI state after submit)
  const currentUserImageIds = Array.isArray(ctx.attachedImages)
    ? ctx.attachedImages.map((i) => i.id)
    : [];

  // Always submit the user message first unless we are retrying the same
  // message (e.g. after login / API key refresh)
  if (!skipSubmit) {
    await submitUserMessage();
    // Clear the chat input once the user message has been submitted
    setInput('');
    // Clear local attachments after saving
    if (Array.isArray(ctx.attachedImages) && ctx.attachedImages.length > 0) {
      ctx.clearAttachedImages();
    }
  }

  setIsStreaming(true);

  // Get API key - will return dummy key for proxy-managed auth
  let currentApiKey = '';
  try {
    const keyObject = await ensureApiKey();
    // Always use the key from ensureApiKey (will be dummy key 'sk-vibes-proxy-managed')
    currentApiKey = keyObject?.key || '';
  } catch (err) {
    console.warn('Error getting API key:', err);
    // This should not happen with the new useApiKey implementation
    currentApiKey = 'sk-vibes-proxy-managed';
  }

  // Credit checking no longer needed - proxy handles it

  // Build the history that will be used for the code-writing prompt
  const messageHistory = buildMessageHistory();

  // Compose system prompt with schema-based module selection using prompt + history
  const currentSystemPrompt = await ensureSystemPrompt({
    userPrompt: promptText,
    history: messageHistory,
  });

  return streamAI(
    modelToUse,
    currentSystemPrompt,
    messageHistory,
    promptText,
    (content) => throttledMergeAiMessage(content),
    currentApiKey,
    userId,
    setNeedsLogin,
    currentUserImageIds,
    sessionDatabase
  )
    .then(async (finalContent) => {
      isProcessingRef.current = true;

      try {
        if (typeof finalContent === 'string' && finalContent.startsWith('{')) {
          try {
            const parsedContent = JSON.parse(finalContent);

            if (parsedContent.error) {
              setInput(promptText);
              finalContent = `Error: ${JSON.stringify(parsedContent.error)}`;
            } else {
              finalContent = parsedContent;
            }
          } catch (jsonError) {
            console.warn('Error parsing JSON response:', jsonError, finalContent);
          }
        }

        if (!finalContent) {
          console.warn('No response from AI');
          finalContent = 'Error: No response from AI service.';
        } else if (typeof finalContent === 'string' && finalContent.trim().length === 0) {
          console.warn('Empty response from AI, this might indicate an API issue');
          // Save an error message instead of returning early
          finalContent =
            'Error: Empty response from AI service. This might be due to missing API key or proxy issues.';
        }

        if (aiMessage?.text !== finalContent) {
          aiMessage.text = finalContent;
        }

        aiMessage.model = modelToUse;
        const { id } = (await sessionDatabase.put(aiMessage)) as { id: string };
        setPendingAiMessage({ ...aiMessage, _id: id });
        setSelectedResponseId(id);

        // Skip title generation if the response is an error or title was set manually
        const isErrorResponse =
          typeof finalContent === 'string' && finalContent.startsWith('Error:');
        const titleSetManually = vibeDoc?.titleSetManually === true;

        if (!isErrorResponse && !titleSetManually) {
          const { segments } = parseContent(aiMessage?.text || '');
          try {
            const title = await generateTitle(segments, titleModel, currentApiKey);
            if (title) {
              await updateTitle(title, false); // Mark as AI-generated
            }
          } catch (titleError) {
            console.warn('Failed to generate title:', titleError);
          }
        }
      } finally {
        isProcessingRef.current = false;
      }
    })
    .catch((error: any) => {
      console.warn('Error in sendMessage:', error);
      isProcessingRef.current = false;
      setPendingAiMessage(null);
      setSelectedResponseId('');
    })
    .finally(() => {
      setIsStreaming(false);
      // Credit checking no longer needed
    });
}
